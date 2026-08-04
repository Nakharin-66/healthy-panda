import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { HEALTH_METRICS, ingestSamples } from "@/lib/healthConnect.server";

const payloadSchema = z.object({
  token: z.string().uuid(),
  platform: z.string().max(64).optional(),
  appVersion: z.string().max(32).optional(),
  samples: z
    .array(
      z.object({
        metric: z.enum(HEALTH_METRICS),
        value: z.number().finite(),
        unit: z.string().max(16).optional(),
        recorded_at: z.string().datetime(),
        source: z.string().max(64).optional(),
      }),
    )
    .max(500),
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Content-Type": "application/json",
};

export const Route = createFileRoute("/api/public/health-connect/ingest")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: cors });
        }

        const parsed = payloadSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid payload", issues: parsed.error.issues },
            { status: 400, headers: cors },
          );
        }

        const result = await ingestSamples({
          token: parsed.data.token,
          platform: parsed.data.platform ?? null,
          appVersion: parsed.data.appVersion ?? null,
          samples: parsed.data.samples,
        });

        if (!result.ok) {
          return Response.json({ error: result.message }, { status: result.status, headers: cors });
        }
        return Response.json(result, { headers: cors });
      },
    },
  },
});
