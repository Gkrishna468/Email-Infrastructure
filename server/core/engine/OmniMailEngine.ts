import { GeminiParser } from "../intelligence/GeminiParser.js";
import { EmailRepository } from "../storage/EmailRepository.js";
import { WorkflowEngine } from "./WorkflowEngine.js";
import { OmniMailPayload } from "../types/Email.js";

export class OmniMailEngine {

  static async process(payload: OmniMailPayload) {

    // 1. Persist raw email
    const email = await EmailRepository.store(payload);

    // 2. AI Intelligence
    const intelligence =
      await GeminiParser.analyzeEmail(payload);

    // 3. Save intelligence
    await EmailRepository.attachIntelligence(
      email.id,
      intelligence
    );

    // 4. Trigger workflows
    await WorkflowEngine.route(
      email,
      intelligence
    );

    return {
      email,
      intelligence
    };
  }
}
