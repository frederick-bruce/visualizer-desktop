precision highp float;
uniform float u_time;
uniform float u_beat;
uniform float u_bpm;
uniform float u_energyLow;
uniform float u_energyMid;
uniform float u_energyHigh;
uniform vec2 u_resolution;
uniform int u_colorMode; // 0 spotify,1 neon,2 pastel

// Simple hash / noise
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p); vec2 f=fract(p);
  float a=hash(i); float b=hash(i+vec2(1.,0.)); float c=hash(i+vec2(0.,1.)); float d=hash(i+vec2(1.,1.));
  vec2 u=f*f*(3.-2.*f);
  return mix(a,b,u.x)+ (c-a)*u.y*(1.-u.x)+ (d-b)*u.x*u.y;
}

vec3 palette(float t){
  if(u_colorMode==1) { // neon
    return vec3(0.5+0.5*sin(6.283*t+vec3(0.,2.0,4.0)))*vec3(0.6,0.9,1.2);
  } else if(u_colorMode==2){ // pastel
    return vec3(0.55+0.45*sin(6.283*(t+vec3(0.,0.33,0.66))))*0.85 + 0.15;
  } else { // spotify
    return mix(vec3(0.0,0.4,0.1), vec3(0.2,0.95,0.4), t);
  }
}

void main(){
  vec2 uv = (gl_FragCoord.xy / u_resolution.xy) * 2. - 1.;
  uv.x *= u_resolution.x / u_resolution.y;
  float t = u_time * 0.25 + u_energyLow*0.4;
  float scale = 1.0 + u_beat*0.6 + u_energyHigh*0.3;
  vec2 p = uv * scale;
  float n = 0.0;
  float amp = 0.5;
  for(int i=0;i<4;i++){
    n += noise(p + float(i)*1.3 + t)*amp;
    p *= 1.9;
    amp *= 0.55;
  }
  float energy = u_energyMid*0.5 + u_energyHigh*0.5;
  float glow = smoothstep(0.2,1.2,n + energy*0.8 + u_beat*0.5);
  vec3 col = palette(n + energy*0.3);
  col *= 0.25 + glow;
  col += u_beat*0.3;
  gl_FragColor = vec4(col,1.0);
}
