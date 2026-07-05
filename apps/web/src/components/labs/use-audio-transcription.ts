"use client";

import { transcribeAudio, type TranscriptionResponse } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";

export type AudioTranscriptionPhase = "idle" | "recording" | "uploading" | "unsupported" | "error";

const WEBM_OPUS = "audio/webm;codecs=opus";
const WEBM = "audio/webm";
const DEFAULT_IDLE_MESSAGE = "MIC READY · SPEAK IN SPANISH";
const UNSUPPORTED_MESSAGE = "VOICE RECORDING NEEDS A BROWSER WITH MICROPHONE RECORDING SUPPORT";

function getRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  if (MediaRecorder.isTypeSupported(WEBM_OPUS)) return WEBM_OPUS;
  if (MediaRecorder.isTypeSupported(WEBM)) return WEBM;
  return "";
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function useAudioTranscription({
  brandId,
  onSaved,
  onTranscript,
}: {
  brandId?: string;
  onSaved?: (brief: TranscriptionResponse) => void;
  onTranscript: (value: string) => void;
}) {
  const [phase, setPhase] = useState<AudioTranscriptionPhase>("idle");
  const [message, setMessage] = useState(DEFAULT_IDLE_MESSAGE);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const shouldTranscribeRef = useRef(false);
  const mountedRef = useRef(true);
  const brandIdRef = useRef(brandId);
  const onSavedRef = useRef(onSaved);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    brandIdRef.current = brandId;
    onSavedRef.current = onSaved;
    onTranscriptRef.current = onTranscript;
  }, [brandId, onSaved, onTranscript]);

  useEffect(
    () => () => {
      mountedRef.current = false;
      shouldTranscribeRef.current = false;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      stopStream(streamRef.current);
    },
    [],
  );

  const start = useCallback(async () => {
    if (!brandIdRef.current) {
      setPhase("error");
      setMessage("BRAND REQUIRED BEFORE RECORDING");
      return false;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setPhase("unsupported");
      setMessage(UNSUPPORTED_MESSAGE);
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      chunksRef.current = [];
      shouldTranscribeRef.current = true;
      streamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const activeMimeType = recorder.mimeType || mimeType || WEBM;
        const audio = new Blob(chunksRef.current, { type: activeMimeType });

        recorderRef.current = null;
        chunksRef.current = [];
        stopStream(streamRef.current);
        streamRef.current = null;

        if (!shouldTranscribeRef.current) return;

        if (!audio.size) {
          if (!mountedRef.current) return;
          setPhase("error");
          setMessage("NO AUDIO RECORDED · CLICK THE MIC AND TRY AGAIN");
          return;
        }

        if (!mountedRef.current) return;
        setPhase("uploading");
        setMessage("TRANSCRIBING WITH WHISPER...");

        const activeBrandId = brandIdRef.current;
        if (!activeBrandId) {
          setPhase("error");
          setMessage("BRAND REQUIRED BEFORE RECORDING");
          return;
        }

        transcribeAudio(audio, { brandId: activeBrandId })
          .then((brief) => {
            if (!mountedRef.current) return;
            onSavedRef.current?.(brief);
            onTranscriptRef.current(brief.text);
            setPhase("idle");
            setMessage(DEFAULT_IDLE_MESSAGE);
          })
          .catch((err: unknown) => {
            if (!mountedRef.current) return;
            setPhase("error");
            setMessage(err instanceof Error ? err.message.toUpperCase() : "COULD NOT TRANSCRIBE AUDIO");
          });
      };

      recorder.start();
      setPhase("recording");
      setMessage("RECORDING... CLICK AGAIN TO TRANSCRIBE");
      return true;
    } catch (err) {
      stopStream(streamRef.current);
      streamRef.current = null;
      recorderRef.current = null;
      setPhase("error");
      setMessage(err instanceof DOMException && err.name === "NotAllowedError" ? "MICROPHONE BLOCKED · ENABLE PERMISSION" : "MICROPHONE COULD NOT START");
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  return {
    phase,
    message,
    start,
    stop,
  };
}
