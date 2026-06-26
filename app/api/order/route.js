import { supabase } from "../../../lib/supabase";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://flowgo.cz",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(req) {
  try {
    const data = await req.json();
    console.log("ORDER API DATA:", data);

    const insertData = {
      pickup_address: data.pickup_address || "",
      delivery_address: data.delivery_address || "",
      user_email: data.user_email || "",
      price: Number(data.price) || 0,
      status: "Nová objednávka",
    };

    console.log("INSERT DATA:", insertData);

    const { error } = await supabase.from("orders").insert([insertData]);

    if (error) {
      console.error("SUPABASE INSERT ERROR:", error);
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
    console.error("ORDER API CATCH ERROR:", err);
    return Response.json(
      { success: false, error: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}