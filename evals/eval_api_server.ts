import express from "express";
import { z } from "zod";
import { initStagehand } from "./initStagehand";
import { EvalLogger } from "./logger";

// Define request body schema
const RequestSchema = z.object({
  command: z.string().describe("The instruction or command to execute"),
  start_url: z.string().url().describe("Starting URL to navigate to"),
  cdp_url: z.string().url().describe("Chrome DevTools Protocol URL"),
  output_schema: z.string().optional().describe("The schema to output"),
  mode: z.enum(["actions", "output"]).describe("The mode to run in"),
  model_name: z.string().default("gpt-4o").describe("The model to use"),
});

const app = express();

app.use(express.json());

app.post("/test", async (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Validate request body
    const { command, start_url: startUrl, cdp_url: cdpUrl, output_schema: outputSchema, mode, model_name: modelName } = RequestSchema.parse(_req.body);

    console.log("command", command);
    console.log("startUrl", startUrl);
    console.log("cdpUrl", cdpUrl);

    const logger = new EvalLogger();
    const { stagehand } = await initStagehand({
      modelName: "gpt-4o",
      logger,
      configOverrides: {
        env: "REMOTE",
        cdpUrl,
        debugDom: false,
      },
    });

    res.write('data: {"message": "Navigating to page"}\n\n');
    await stagehand.page.goto(startUrl);

    res.write('data: {"message": "Executing command"}\n\n');
    let output; 
    if (mode === "actions") {
      output = await stagehand.page.act({
        action: command,
      });
    } else {
      output = await stagehand.page.extract({
        instruction: command,
        schema: z.object({
          schema: z.string().describe(outputSchema),
        }),
        modelName: modelName,
        useTextExtract: true,
      });
    }

    const data = {
      "type": "answer",
      "message": output
    }

    res.write(`data: ${JSON.stringify(data)}\n\n`);

    res.end();
  } catch (error) {
    res.write('data: {"message": "Error", "error": ' + JSON.stringify({message: error.message}) + '}\n\n');
    res.end();
  }
});

app.listen(8001, () => {
  console.log("Server is running on port 8001");
});
