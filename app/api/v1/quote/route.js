import { NextResponse } from "next/server";
import { createFlowGoQuote } from "../../../../lib/flowgoQuote";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, X-FlowGo-Api-Key",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

function hasValidPartnerApiKey(request) {
  const expectedKey = process.env.FLOWGO_PARTNER_API_KEY;
  const receivedKey = request.headers.get("x-flowgo-api-key");

  return Boolean(
    expectedKey &&
      receivedKey &&
      receivedKey === expectedKey
  );
}

export async function POST(request) {
  try {
    if (!hasValidPartnerApiKey(request)) {
      return NextResponse.json(
        {
          success: false,
          available: false,
          message: "Neplatný FlowGo API kľúč.",
        },
        {
          status: 401,
          headers: corsHeaders,
        }
      );
    }

    const body = await request.json();

    const pickupAddress =
      body.pickup_address?.trim();

    const deliveryAddress =
      body.delivery_address?.trim();

    if (!pickupAddress || !deliveryAddress) {
      return NextResponse.json(
        {
          success: false,
          available: false,
          message:
            "Vyplňte adresu vyzdvihnutia aj doručenia.",
        },
        {
          status: 400,
          headers: corsHeaders,
        }
      );
    }

    const quote = await createFlowGoQuote(
      pickupAddress,
      deliveryAddress
    );

    return NextResponse.json(quote, {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("FlowGo quote error:", error);

    return NextResponse.json(
      {
        success: false,
        available: false,
        message:
          error.message ||
          "Pri výpočte dopravy nastala chyba.",
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}