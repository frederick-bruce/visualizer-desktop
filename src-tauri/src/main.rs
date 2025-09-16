#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod plugins {
  pub mod loopback;
}

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(plugins::loopback::init())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
