import speech from "@google-cloud/speech";
import textToSpeech from "@google-cloud/text-to-speech";

export type Point = { lat: number; lng: number };
export type RouteSummary = { distanceMeters: number; duration: string; encodedPolyline: string };

export interface ExternalIntegrations {
  route(origin: Point, destination: Point): Promise<RouteSummary>;
  transcribe(webmOpus: Buffer, languageCode: string, sampleRateHertz: number): Promise<string>;
  speak(text: string, languageCode: string): Promise<Buffer>;
}

export class GoogleIntegrations implements ExternalIntegrations {
  private speechClient?: speech.SpeechClient;
  private ttsClient?: textToSpeech.TextToSpeechClient;

  constructor(private readonly mapsServerKey?: string) {}

  async route(origin: Point, destination: Point): Promise<RouteSummary> {
    if (!this.mapsServerKey) throw new Error("GOOGLE_MAPS_SERVER_KEY is not configured");
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.mapsServerKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
        destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
      }),
    });
    if (!response.ok) throw new Error(`Google Routes failed (${response.status})`);
    const body = await response.json() as {
      routes?: Array<{ distanceMeters?: number; duration?: string;
        polyline?: { encodedPolyline?: string } }>;
    };
    const first = body.routes?.[0];
    if (!first?.distanceMeters || !first.duration || !first.polyline?.encodedPolyline) {
      throw new Error("Google Routes returned no route");
    }
    return {
      distanceMeters: first.distanceMeters, duration: first.duration,
      encodedPolyline: first.polyline.encodedPolyline,
    };
  }

  async transcribe(webmOpus: Buffer, languageCode: string, sampleRateHertz: number): Promise<string> {
    this.speechClient ??= new speech.SpeechClient();
    const [response] = await this.speechClient.recognize({
      audio: { content: webmOpus },
      config: { encoding: "WEBM_OPUS", sampleRateHertz, languageCode },
    });
    return response.results?.flatMap(result =>
      result.alternatives?.[0]?.transcript ? [result.alternatives[0].transcript] : [],
    ).join(" ") ?? "";
  }

  async speak(text: string, languageCode: string): Promise<Buffer> {
    this.ttsClient ??= new textToSpeech.TextToSpeechClient();
    const [response] = await this.ttsClient.synthesizeSpeech({
      input: { text }, voice: { languageCode },
      audioConfig: { audioEncoding: "MP3" },
    });
    if (!response.audioContent) throw new Error("Google Speech returned no audio");
    return Buffer.from(response.audioContent);
  }
}
