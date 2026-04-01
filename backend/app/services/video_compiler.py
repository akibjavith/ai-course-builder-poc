import os
import requests
import uuid
from pathlib import Path
from openai import OpenAI
import imageio_ffmpeg
import subprocess

client = OpenAI()

# Get the path to the ffmpeg executable bundled with imageio-ffmpeg
FFMPEG_BIN = imageio_ffmpeg.get_ffmpeg_exe()

def download_image(url: str, dest_path: str):
    response = requests.get(url)
    with open(dest_path, "wb") as f:
        f.write(response.content)

def generate_audio_and_subtitles(text: str, audio_path: str, srt_path: str):
    # 1. Generate TTS
    response = client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=text
    )
    response.stream_to_file(audio_path)
    
    # 2. Transcribe to get perfect SRT syncing using Whisper
    with open(audio_path, "rb") as audio_file:
        transcription = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="srt"
        )
    
    with open(srt_path, "w", encoding="utf-8") as f:
        f.write(transcription)

def escape_subtitle_path(path_str):
    # FFmpeg subtitle filter needs paths to have backslashes escaped and colons escaped, 
    # but it's notoriously difficult on Windows. A simple fix is replacing \ with / and removing colon logic or just using relative paths.
    p = str(Path(path_str).resolve().as_posix())
    # Ffmpeg subtitles filter escapes: 
    # Replace ':' with '\\:'
    return p.replace(':', '\\\\:')

def compile_video(image_url: str, lesson_text: str, output_filename: str):
    """
    Orchestrates the creation of an MP4 video with Image, TTS Audio, and burned SRT subtitles.
    Returns the final relative URL/path for the video.
    """
    uploads_dir = Path(__file__).parent.parent / "uploads"
    uploads_dir.mkdir(exist_ok=True, parents=True)
    
    session_id = str(uuid.uuid4())[:8]
    img_path = str(uploads_dir / f"img_{session_id}.jpg")
    audio_path = str(uploads_dir / f"audio_{session_id}.mp3")
    srt_path = str(uploads_dir / f"sub_{session_id}.srt")
    out_vid_path = str(uploads_dir / output_filename)
    
    try:
        # Download Image
        download_image(image_url, img_path)
        
        # Generate Audio and SRT
        generate_audio_and_subtitles(lesson_text, audio_path, srt_path)
        
        # We need relative paths for FFmpeg to safely avoid Windows Drive colon issues in the subtitles filter
        # Let's run FFmpeg in the uploads directory
        
        # Build ffmpeg command
        # -loop 1 -i img -i audio -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -shortest out.mp4
        
        rel_img = f"img_{session_id}.jpg"
        rel_audio = f"audio_{session_id}.mp3"
        rel_srt = f"sub_{session_id}.srt"
        
        # Subtitles filter requires proper escaping if using complex paths, but since we are in the same dir, we can just use the flat filename!
        
        cmd = [
            FFMPEG_BIN,
            '-y', # Overwrite
            '-loop', '1',
            '-i', rel_img,
            '-i', rel_audio,
            '-vf', f"scale=-2:720,subtitles={rel_srt}:force_style='FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H40000000,BorderStyle=3'", # Burn subtitles
            '-c:v', 'libx264',
            '-tune', 'stillimage',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-pix_fmt', 'yuv420p',
            '-shortest',
            output_filename
        ]
        
        # Run subprocess
        result = subprocess.run(cmd, cwd=str(uploads_dir), stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if result.returncode != 0:
            print("FFMPEG ERROR:", result.stderr)
            raise Exception("Video compilation failed")
            
        return f"/uploads/{output_filename}"
        
    finally:
        # Optional: cleanup temporary files
        for p in [img_path, audio_path, srt_path]:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except:
                    pass
