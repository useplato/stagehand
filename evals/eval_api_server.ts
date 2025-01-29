import express from "express";
import { z } from "zod";
import { initStagehand } from "./initStagehand";
import { EvalLogger } from "./logger";

// At the top of the file, add this type
const ModelNames = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4o-2024-08-06",
  "claude-3-5-sonnet-latest",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-20240620",
  "o1-mini",
  "o1-preview",
] as const;

// Define request body schema
const RequestSchema = z.object({
  command: z.string().describe("The instruction or command to execute"),
  start_url: z.string().url().describe("Starting URL to navigate to"),
  cdp_url: z.string().url().describe("Chrome DevTools Protocol URL"),
  output_schema: z.record(z.any()).nullable().optional().describe("The schema to output"),
  mode: z.enum(["actions", "output"]).describe("The mode to run in"),
  model_name: z.enum(ModelNames).default("gpt-4o").describe("The model to use"),
});

const app = express();

app.use(express.json());

app.post("/init", async (_req, res) => {
  try {
    await initStagehand({
      modelName: "gpt-4o",
      logger: new EvalLogger(),
      configOverrides: {
        env: "REMOTE",
        cdpUrl: _req.body.cdp_url,
        debugDom: false,
      },
    });

    // await stagehand.page.goto("https://www.google.com");
    console.log("init done");
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
      });
  } catch (error) {
    console.error(error);
    console.error(error.stack);
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

app.post("/test", async (_req, res) => {
  try {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    // Validate request body
    const {
      command,
      start_url: startUrl,
      cdp_url: cdpUrl,
      output_schema: outputSchema,
      mode,
      model_name: modelName,
    } = RequestSchema.parse(_req.body);

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

    // res.write('data: {"message": "Navigating to page"}\n\n');
    // await stagehand.page.goto(startUrl);

    // Inject the processDom function and related utilities into the current page
    res.write('data: {"message": "Injecting processDom function"}\n\n');

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
          schema: z.string().describe(JSON.stringify(outputSchema)),
        }),
        modelName: modelName,
        useTextExtract: true,
      });
    }

    const data = {
      type: "answer",
      message: output,
    };

    res.write(`data: ${JSON.stringify(data)}\n\n`);

    res.end();
  } catch (error) {
    // print error and stack trace
    console.error(error);
    console.error(error.stack);
    res.write(
      'data: {"message": "Error", "error": ' +
        JSON.stringify({ message: error.message }) +
        "}\n\n",
    );
    res.end();
  }
} catch (err) {
  console.error(err);
  console.error(err.stack);
  res.write(
    'data: {"message": "Error", "error": ' +
      JSON.stringify({ message: err.message }) +
      "}\n\n",
  );
  res.end();
}
});

app.get("/version", (req, res) => {
  res.json({
    version: "v0.1",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Global error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error handler caught:', err);
  console.error(err.stack);
  
  // Don't send error details in production
  res.status(500).json({
    status: 'error',
    message: 'An internal server error occurred'
  });
});

// Catch unhandled rejections and exceptions
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  // Gracefully shutdown if needed
  // process.exit(1);
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
