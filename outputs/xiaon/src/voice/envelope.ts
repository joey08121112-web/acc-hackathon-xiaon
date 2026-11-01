/** Playback motion is sampled from the decoded TTS audio, never from synthetic oscillation. */
export function audioEnvelope(samples:Float32Array,sampleRate:number,fps=40):Float32Array{
 const stride=Math.max(1,Math.floor(sampleRate/fps)),out=new Float32Array(Math.ceil(samples.length/stride));
 for(let start=0,i=0;start<samples.length;start+=stride,i++){
  const end=Math.min(samples.length,start+stride);let sum=0;for(let j=start;j<end;j++)sum+=samples[j]*samples[j];
  out[i]=Math.min(1,Math.sqrt(sum/(end-start))*3);
 }
 return out;
}
