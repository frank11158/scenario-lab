import { ModelAdapterError, type ModelAdapter, type ModelRequest, type ModelResponse } from "./types.js";

export class UnavailableModelAdapter implements ModelAdapter {
  readonly provider = "unavailable";
  readonly model = "not-configured";
  readonly modelVersion = null;

  async generate(_request: ModelRequest): Promise<ModelResponse> {
    throw new ModelAdapterError("Model generation is unavailable. Configure OPENAI_API_KEY and OPENAI_MODEL, or continue editing the study manually.", false);
  }
}
