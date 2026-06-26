import { supabase } from "../../../lib/supabase";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://flowgo.cz",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req) {
  try {
    const data = await req.json();

    const { error } = await supabase.from("orders").insert([
      {
        pickup_address: data.pickup_address || "",
        delivery_address: data.delivery_address || "",
        stops: data.stops || "",
        user_email: data.user_email || "",
        customer_name: data.customer_name || "",
        customer_phone: data.customer_phone || "",
        price: data.price || 0,
        status: "Nová objednávka",
      },
    ]);

    if (error) {
      return Response.json(
        { success: false, error: error.message },
        { status: 500, headers: corsHeaders }
      );
    }

    return Response.json(
      { success: true },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return Response.json(
      { success: false, error: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}