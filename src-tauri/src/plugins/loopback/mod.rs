use std::sync::{Arc, Mutex};

use base64::{engine::general_purpose, Engine as _};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, SampleFormat, SampleRate, Stream};
use serde::Serialize;
use tauri::{plugin::TauriPlugin, AppHandle, Emitter, Manager, Runtime, State};

#[derive(Default)]
struct LoopbackState {
    stream: Option<Stream>,
}

#[derive(Serialize)]
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
fn startLoopback<R: Runtime>(app: AppHandle<R>, state: State<'_, Arc<Mutex<LoopbackState>>>) -> Result<(), String> {
    let mut st = state.lock().unwrap();
    if st.stream.is_some() {
        return Ok(());
    }
    let device = find_wasapi_loopback_device().ok_or_else(|| "No WASAPI output device found".to_string())?;
    let configs = device.supported_input_configs().map_err(|e| format!("query config: {e}"))?;
    let mut chosen = None;
    for cfg in configs {
        if cfg.sample_format() == SampleFormat::F32 {
            chosen = Some(cfg.with_max_sample_rate().config());
            break;
        }
    }
    let mut config = chosen.unwrap_or_else(|| cpal::StreamConfig {
        channels: 2,
        sample_rate: SampleRate(48000),
        buffer_size: cpal::BufferSize::Default,
    });

    let app_clone = app.clone();
    let channels = config.channels as usize;
    let sr = config.sample_rate.0;

    let target_frames_per_chunk = (sr as f32 * 0.01) as usize; // ~10ms
    let mut chunk: Vec<f32> = Vec::with_capacity(target_frames_per_chunk);

    let stream = match device.build_input_stream(
        &config,
        move |data: &[f32], _| {
            let frames = data.len() / channels;
            for f in 0..frames {
                let mut sum = 0.0f32;
                for c in 0..channels { sum += data[f * channels + c]; }
                let mono = sum / (channels as f32);
                chunk.push(mono);
                if chunk.len() >= target_frames_per_chunk {
                    let bytes = unsafe { std::slice::from_raw_parts(chunk.as_ptr() as *const u8, chunk.len() * std::mem::size_of::<f32>()) };
                    let b64 = general_purpose::STANDARD.encode(bytes);
                    let _ = app_clone.emit("loopback:pcm", PcmEvent { pcm_base64: &b64, sample_rate: sr, channels: 1 });
                    chunk.clear();
                }
            }
        },
        move |err| {
            eprintln!("loopback stream error: {err}");
        },
        None,
    ) {
        Ok(s) => s,
        Err(e) => return Err(format!("build stream: {e}")),
    };
    stream.play().map_err(|e| format!("start stream: {e}"))?;
    st.stream = Some(stream);
    Ok(())
}

#[allow(non_snake_case)]
#[tauri::command(rename_all = "camelCase")]
fn stopLoopback(state: State<'_, Arc<Mutex<LoopbackState>>>) -> Result<(), String> {
    let mut st = state.lock().unwrap();
    st.stream.take();
    Ok(())
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    tauri::plugin::Builder::new("loopback")
    .invoke_handler(tauri::generate_handler![startLoopback, stopLoopback])
        .setup(|app, _| {
            app.manage::<Arc<Mutex<LoopbackState>>>(Arc::new(Mutex::new(LoopbackState::default())));
            Ok(())
        })
        .build()
}
