use std::sync::{mpsc, Mutex};
use std::thread::{self, JoinHandle};

use base64::{engine::general_purpose, Engine as _};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, SampleFormat, SampleRate};
use serde::Serialize;
use tauri::{plugin::TauriPlugin, AppHandle, Emitter, Manager, Runtime, State};

#[derive(Default)]
struct LoopbackState {
    stop_tx: Option<mpsc::Sender<()>>,
    handle: Option<JoinHandle<()>>,
}

#[derive(Serialize, Clone)]
struct PcmEvent<'a> {
    pcm_base64: &'a str,
    sample_rate: u32,
    channels: u16,
}

fn find_wasapi_loopback_device() -> Option<Device> {
    #[cfg(target_os = "windows")]
    {
        let host = cpal::host_from_id(cpal::HostId::Wasapi).ok()?;
        let out_name = host.default_output_device().and_then(|d| d.name().ok());
        // Prefer an input device whose name contains "loopback" and optionally matches the output device name
        if let Ok(mut inputs) = host.input_devices() {
            if let Some(ref on) = out_name {
                if let Some(dev) = inputs.find(|d| d.name().ok().map_or(false, |n| n.to_lowercase().contains("loopback") && n.contains(on))) {
                    return Some(dev);
                }
            }
        }
        if let Ok(mut inputs) = host.input_devices() {
            if let Some(dev) = inputs.find(|d| d.name().ok().map_or(false, |n| n.to_lowercase().contains("loopback"))) {
                return Some(dev);
            }
        }
        // Fallback: default input device (may capture mic if loopback not available)
        host.default_input_device()
    }
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

#[allow(non_snake_case)]
#[tauri::command(rename_all = "camelCase")]
fn startLoopback<R: Runtime>(app: AppHandle<R>, state: State<'_, Mutex<LoopbackState>>) -> Result<(), String> {
    let mut st = state.lock().unwrap();
    if st.handle.is_some() { return Ok(()) }

    let (tx, rx) = mpsc::channel::<()>();
    let app_clone = app.clone();
    let handle = thread::spawn(move || {
        let Some(device) = find_wasapi_loopback_device() else { eprintln!("no wasapi loopback device"); return; };
        let configs = match device.supported_input_configs() { Ok(c) => c, Err(e) => { eprintln!("query config: {e}"); return; } };
        let mut chosen = None;
        for cfg in configs {
            if cfg.sample_format() == SampleFormat::F32 { chosen = Some(cfg.with_max_sample_rate().config()); break; }
        }
        let config = chosen.unwrap_or_else(|| cpal::StreamConfig { channels: 2, sample_rate: SampleRate(48000), buffer_size: cpal::BufferSize::Default });
        let channels = config.channels as usize;
        let sr = config.sample_rate.0;
        let mut chunk: Vec<f32> = Vec::with_capacity((sr as f32 * 0.01) as usize);
        let target = chunk.capacity();
        let app_emit = app_clone;
        let stream = match device.build_input_stream(
            &config,
            move |data: &[f32], _| {
                let frames = data.len() / channels;
                for f in 0..frames {
                    let mut sum = 0.0f32; for c in 0..channels { sum += data[f*channels + c]; }
                    let mono = sum / (channels as f32);
                    chunk.push(mono);
                    if chunk.len() >= target {
                        let bytes = unsafe { std::slice::from_raw_parts(chunk.as_ptr() as *const u8, chunk.len()*std::mem::size_of::<f32>()) };
                        let b64 = general_purpose::STANDARD.encode(bytes);
                        let _ = app_emit.emit("loopback:pcm", PcmEvent { pcm_base64: &b64, sample_rate: sr, channels: 1 });
                        chunk.clear();
                    }
                }
            },
            move |err| { eprintln!("loopback stream error: {err}"); },
            None,
        ) { Ok(s) => s, Err(e) => { eprintln!("build stream: {e}"); return; } };
        if let Err(e) = stream.play() { eprintln!("start stream: {e}"); return; }
        // Wait for stop signal
        let _ = rx.recv();
        drop(stream);
    });

    st.stop_tx = Some(tx);
    st.handle = Some(handle);
    Ok(())
}

#[allow(non_snake_case)]
#[tauri::command(rename_all = "camelCase")]
fn stopLoopback(state: State<'_, Mutex<LoopbackState>>) -> Result<(), String> {
    let mut st = state.lock().unwrap();
    if let Some(tx) = st.stop_tx.take() { let _ = tx.send(()); }
    if let Some(h) = st.handle.take() { let _ = h.join(); }
    Ok(())
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    tauri::plugin::Builder::new("loopback")
    .invoke_handler(tauri::generate_handler![startLoopback, stopLoopback])
        .setup(|app, _| {
            app.manage::<Mutex<LoopbackState>>(Mutex::new(LoopbackState::default()));
            Ok(())
        })
        .build()
}
