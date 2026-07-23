import { NextResponse } from "next/server";

const GOOGLE_ROUTES_API_URL =
  "https://routes.googleapis.com/directions/v2:computeRoutes";

const GOOGLE_GEOCODING_API_URL =
  "https://maps.googleapis.com/maps/api/geocode/json";

function calculatePrice(distanceKm, region) {
  if (region === "Praha") {
    if (distanceKm <= 3) return 229;
    if (distanceKm <= 5) return 249;
    if (distanceKm <= 10) return 289;
    if (distanceKm <= 20) return 389;

    return 389 + Math.ceil(distanceKm - 20) * 12;
  }

  if (region === "Středočeský kraj") {
    if (distanceKm <= 20) return 399;

    return 399 + Math.ceil(distanceKm - 20) * 12;
  }

  return null;
}

async function geocodeAddress(address, apiKey) {
  const url = new URL(GOOGLE_GEOCODING_API_URL);

  url.searchParams.set("address", address);
  url.searchParams.set("region", "cz");
  url.searchParams.set("language", "cs");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, {
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok || data.status !== "OK" || !data.results?.length) {
    throw new Error(
      data.error_message || `Adresu se nepodařilo ověřit: ${address}`
    );
  }

  const result = data.results[0];

  const regionComponent = result.address_components.find((component) =>
    component.types.includes("administrative_area_level_1")
  );

  const countryComponent = result.address_components.find((component) =>
    component.types.includes("country")
  );

  return {
    formattedAddress: result.formatted_address,
    placeId: result.place_id,
    region: regionComponent?.long_name || null,
    countryCode: countryComponent?.short_name || null,
  };
}

async function calculateRoute(originPlaceId, destinationPlaceId, apiKey) {
  const response = await fetch(GOOGLE_ROUTES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "routes.distanceMeters,routes.duration,routes.localizedValues",
    },
    body: JSON.stringify({
      origin: {
        placeId: originPlaceId,
      },
      destination: {
        placeId: destinationPlaceId,
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      languageCode: "cs-CZ",
      units: "METRIC",
    }),
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok || !data.routes?.length) {
    throw new Error(
      data.error?.message || "Nepodařilo se vypočítat trasu."
    );
  }

  return data.routes[0];
}

export async function POST(request) {
  try {
    const apiKey = process.env.GOOGLE_ROUTES_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          message: "Na serveru chybí GOOGLE_ROUTES_API_KEY.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const pickupAddress = body.pickup_address?.trim();
    const deliveryAddress = body.delivery_address?.trim();

    if (!pickupAddress || !deliveryAddress) {
      return NextResponse.json(
        {
          success: false,
          message: "Vyplňte adresu vyzvednutí i doručení.",
        },
        { status: 400 }
      );
    }

    const [pickup, delivery] = await Promise.all([
      geocodeAddress(pickupAddress, apiKey),
      geocodeAddress(deliveryAddress, apiKey),
    ]);

    if (pickup.countryCode !== "CZ" || delivery.countryCode !== "CZ") {
      return NextResponse.json(
        {
          success: true,
          available: false,
          message: "FlowGo doručuje pouze v České republice.",
        },
        { status: 200 }
      );
    }

    const allowedRegions = ["Hlavní město Praha", "Středočeský kraj"];

    if (!allowedRegions.includes(delivery.region)) {
      return NextResponse.json(
        {
          success: true,
          available: false,
          region: delivery.region,
          message:
            "FlowGo je dostupné pouze pro Prahu a Středočeský kraj.",
        },
        { status: 200 }
      );
    }

    const route = await calculateRoute(
      pickup.placeId,
      delivery.placeId,
      apiKey
    );

    const distanceKm =
      Math.round((route.distanceMeters / 1000) * 10) / 10;

    const pricingRegion =
      delivery.region === "Hlavní město Praha"
        ? "Praha"
        : "Středočeský kraj";

    const price = calculatePrice(distanceKm, pricingRegion);

    return NextResponse.json({
      success: true,
      available: true,
      pickup_address: pickup.formattedAddress,
      delivery_address: delivery.formattedAddress,
      region: pricingRegion,
      distance_km: distanceKm,
      duration: route.localizedValues?.duration?.text || route.duration,
      price,
      currency: "CZK",
    });
  } catch (error) {
    console.error("FlowGo quote error:", error);

    return NextResponse.json(
      {
        success: false,
        available: false,
        message: error.message || "Při výpočtu dopravy nastala chyba.",
      },
      { status: 500 }
    );
  }
}