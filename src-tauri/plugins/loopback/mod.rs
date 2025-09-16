use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use base64::{engine::general_purpose, Engine as _};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, SampleFormat, SampleRate, Stream};
use serde::Serialize;
use tauri::{Emitter, Manager};

#[derive(Default)]
struct LoopbackState {
    stream: Option<Stream>,
}

#[derive(Serialize)]
struct PcmEvent<'a> {
    // base64 of f32le PCM frames for a single channel or interleaved? We'll send mono averaged frames.
    pcm_base64: &'a str,
    sample_rate: u32,
    channels: u16,
}

fn find_wasapi_loopback_device() -> Option<Device> {
    #[cfg(target_os = "windows")]
    {
        let host = cpal::host_from_id(cpal::HostId::Wasapi).ok()?;
        // WASAPI loopback uses the default output device but opened in loopback mode via SupportedStreamConfig.
        // cpal hides explicit loopback flag; instead, we can use the host.default_output_device() with input stream on wasapi? 
        // In cpal 0.15, a dedicated loopback device API is not exposed. We can try default_output_device and build_input_stream_raw with wasapi specific config.
        // As a pragmatic approach, try default_output_device() and use build_input_stream on it; on WASAPI this maps to loopback.
        if let Some(dev) = host.default_output_device() {
            return Some(dev);
        }
        None
    }
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

#[tauri::command]
fn start_loopback<R: tauri::Runtime>(app: tauri::AppHandle<R>, state: tauri::State<'_, Arc<Mutex<LoopbackState>>>) -> Result<(), String> {
    let mut st = state.lock().unwrap();
    if st.stream.is_some() {
        return Ok(());
    }

    let device = find_wasapi_loopback_device().ok_or_else(|| "No WASAPI output device found".to_string())?;
    // Choose a reasonable config
    let configs = device.supported_input_configs().map_err(|e| format!("query config: {e}"))?;
    // Prefer f32, 48000 or 44100, mono if possible
    let mut chosen = None;
    for cfg in configs {
        let sr = cfg.min_sample_rate().0.min(48000).max(44100);
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
    // Downmix to mono in callback for simplicity

    let app_clone = app.clone();
    let channels = config.channels as usize;
    let sr = config.sample_rate.0;

    // We'll buffer about ~10ms of audio per event to keep UI responsive
    let target_frames_per_chunk = (sr as f32 * 0.01) as usize; // 10ms
    let mut chunk: Vec<f32> = Vec::with_capacity(target_frames_per_chunk);

    let stream = match device.build_input_stream(
        &config,
        move |data: &[f32], _| {
            // Interleaved: data length = frames * channels
            let frames = data.len() / channels;
            for f in 0..frames {
                let mut sum = 0.0f32;
                for c in 0..channels { sum += data[f * channels + c]; }
                let mono = sum / (channels as f32);
                chunk.push(mono);
                if chunk.len() >= target_frames_per_chunk {
                    // encode and emit
                    let bytes = unsafe {
                        std::slice::from_raw_parts(
                            chunk.as_ptr() as *const u8,
                            chunk.len() * std::mem::size_of::<f32>(),
                        )
                    };
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

#[tauri::command]
fn stop_loopback(state: tauri::State<'_, Arc<Mutex<LoopbackState>>>) -> Result<(), String> {
    let mut st = state.lock().unwrap();
    // Dropping the stream stops it
    st.stream.take();
    Ok(())
}

pub fn init<R: tauri::Runtime>() -> impl Fn(tauri::App<R>, tauri::ConfigRef) + Sync + Send + 'static {
    move |app, _cfg| {
        app.manage::<Arc<Mutex<LoopbackState>>>(Arc::new(Mutex::new(LoopbackState::default())));
        // register commands
        tauri::plugin::Builder::new("loopback")
            .invoke_handler(tauri::generate_handler![start_loopback, stop_loopback])
            .build(app)
            .expect("failed to register loopback plugin");
    }
}
