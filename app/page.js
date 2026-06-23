"use client";

import { useEffect, useState, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { useJsApiLoader } from "@react-google-maps/api";
import { supabase } from "../lib/supabase";

const libraries = ["places"];

export default function Home() {
  const [screen, setScreen] = useState("order");
  const [orders, setOrders] = useState([]);

  const [monthlyOrdersCount, setMonthlyOrdersCount] = useState(0);
const [monthlyRevenue, setMonthlyRevenue] = useState(0);

const [companyName, setCompanyName] = useState("");
const [companyIco, setCompanyIco] = useState("");
const [isRegisterMode, setIsRegisterMode] = useState(false);

  const [user, setUser] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const [pickupAddress, setPickupAddress] = useState("");
const [deliveryAddress, setDeliveryAddress] = useState("");
  const [stops, setStops] = useState([]);
  const [pickupAutocomplete, setPickupAutocomplete] = useState(null);
  const [deliveryAutocomplete, setDeliveryAutocomplete] = useState(null);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [pickupSignedName, setPickupSignedName] = useState("");
const [deliverySignedName, setDeliverySignedName] = useState("");

  const [distanceKm, setDistanceKm] = useState(0);
  const [message, setMessage] = useState("");

  const pickupSigRef = useRef();
const deliverySigRef = useRef();

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
  setUser(data.user);

  if (data.user?.email) {
    const { data: company } = await supabase
      .from("companies")
      .select("*")
      .eq("email", data.user.email)
      .single();

    if (company) {
      setCompanyName(company.company_name);
      setCompanyIco(company.ico);
    }
  }
});

    const { data: listener } = supabase.auth.onAuthStateChange(
  async (_event, session) => {
    const currentUser = session?.user || null;
    setUser(currentUser);

    if (currentUser?.email) {
      const { data: company } = await supabase
        .from("companies")
        .select("*")
        .eq("email", currentUser.email)
        .single();

      if (company) {
        setCompanyName(company.company_name);
        setCompanyIco(company.ico);
      }
    }
  }
);

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  function calculatePrice(km) {
    if (!km || km <= 0) return 199;
    if (km <= 3) return 199;
    if (km <= 5) return 229;
    if (km <= 10) return 269;
    if (km <= 20) return 369;
    return Math.round(369 + (km - 20) * 14);
  }

  const price = calculatePrice(distanceKm);

const isAdmin =
  user?.email?.trim().toLowerCase() === "obchod@flowgo.cz";

  console.log("Prihlásený email:", user?.email);
console.log("isAdmin:", isAdmin);

  function onPickupPlaceChanged() {
    const place = pickupAutocomplete?.getPlace();
    if (place?.formatted_address) {
      setPickupAddress(place.formatted_address);
      setDistanceKm(0);
    }
  }

  function onDeliveryPlaceChanged() {
    const place = deliveryAutocomplete?.getPlace();
    if (place?.formatted_address) {
      setDeliveryAddress(place.formatted_address);
      setDistanceKm(0);
    }
  }

  function calculateDistance() {
    if (!window.google) {
      setMessage("Google Maps sa ešte načítava.");
      return;
    }

    setMessage("Počítam vzdialenosť...");

    const allStops = [
  pickupAddress,
  ...stops.filter(stop => stop.trim() !== ""),
  deliveryAddress
];

    const service = new window.google.maps.DistanceMatrixService();

    let totalKm = 0;

function calculateLeg(index) {
  if (index >= allStops.length - 1) {
    setDistanceKm(totalKm);
    setMessage(`Vzdialenosť: ${totalKm.toFixed(1)} km`);
    return;
  }

  service.getDistanceMatrix(
    {
      origins: [allStops[index]],
      destinations: [allStops[index + 1]],
      travelMode: window.google.maps.TravelMode.DRIVING,
      unitSystem: window.google.maps.UnitSystem.METRIC,
    },
    (response, status) => {
      if (status !== "OK") {
        setMessage("Chyba Google Maps: " + status);
        return;
      }

      const element = response.rows[0].elements[0];

      if (element.status !== "OK") {
        setMessage("Nepodarilo sa vypočítať trasu.");
        return;
      }

      totalKm += element.distance.value / 1000;
      calculateLeg(index + 1);
    }
  );
}

calculateLeg(0);
  }

  async function createOrder() {
    if (!pickupAddress || !deliveryAddress) {
      setMessage("Vyplňte prosím všetky údaje.");
      return;
    }

    if (!distanceKm) {
      setMessage("Najprv klikni na Spočítať vzdialenosť a cenu.");
      return;
    }

    setMessage("Ukladám objednávku...");

    const { error } = await supabase.from("orders").insert([
  {
    pickup_address: pickupAddress,
    delivery_address: deliveryAddress,
    stops: stops.filter((stop) => stop.trim() !== "").join(" | "),
    user_email: user.email,
    price,
    status: "Nová objednávka",
  },
]);

    if (error) {
      setMessage("Chyba: " + error.message);
    } else {

 

  setMessage("Objednávka bola uložená ✅");
  setCustomerName("");
  setCustomerPhone("");
  setCustomerEmail("");
}
  }

 async function loadOrders() {
  setMessage("Načítavam objednávky...");

  let query = supabase
    .from("orders")
    .select("*");

  if (!isAdmin) {
    query = query.eq("user_email", user.email);
  }

  const { data, error } = await query.order("id", {
    ascending: false,
  });

  if (error) {
    setMessage("Chyba: " + error.message);
    return;
  }

 const monthlyOrders = data || [];

setMonthlyOrdersCount(monthlyOrders.length);

const revenue = monthlyOrders.reduce((sum, order) => {
  return sum + Number(order.price || 0);
}, 0);

setMonthlyRevenue(revenue);

  setOrders(data || []);
  setScreen("orders");
  setMessage("");
}

  async function loadDriverOrders() {
    setMessage("Načítavam jazdy pre vodiča...");

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .in("status", ["Nová objednávka", "Přijato", "Na cestě"])
      .order("id", { ascending: false });

    if (error) {
      setMessage("Chyba: " + error.message);
      return;
    }

    setOrders(data || []);
    setScreen("driver");
    setMessage("");
  }

  async function updateOrderPrice(orderId, newPrice) {
  if (!newPrice) {
    setMessage("Zadaj cenu.");
    return;
  }

  const { error } = await supabase
    .from("orders")
    .update({ price: Number(newPrice) })
    .eq("id", orderId);

  if (error) {
    setMessage("Chyba pri ukladaní ceny: " + error.message);
    return;
  }

  setOrders((prevOrders) => {
  const updatedOrders = prevOrders.map((order) =>
    order.id === orderId ? { ...order, price: Number(newPrice) } : order
  );

  const newRevenue = updatedOrders.reduce((sum, order) => {
    return sum + (Number(order.price) || 0);
  }, 0);

  setMonthlyRevenue(newRevenue);

  return updatedOrders;
});

  setMessage("Cena bola upravená ✅");
}

  async function updateOrderStatus(orderId, newStatus) {

  const updateData = {
    status: newStatus,
  };

  if (newStatus === "Na cestě") {
    updateData.pickup_signed_at = new Date().toISOString();
  }

  if (newStatus === "Doručeno") {
    updateData.delivery_signed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", orderId);

    if (error) {
      setMessage("Chyba pri zmene statusu: " + error.message);
      return;
    }

    setOrders((prevOrders) =>
      prevOrders.map((order) =>
        order.id === orderId ? { ...order, status: newStatus } : order
      )
    );

    const changedOrder = orders.find((order) => order.id === orderId);

    console.log("changedOrder:", changedOrder);
console.log("customer_email:", changedOrder?.customer_email);

if (changedOrder?.customer_email) {
  await fetch("/api/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: changedOrder.customer_email,
      subject: "Aktualizace objednávky FlowGo",
      message:
        `Dobrý den,\n\n` +
        `stav Vaší objednávky byl změněn na: ${newStatus}.\n\n` +
        `Vyzvednutí: ${changedOrder.pickup_address}\n` +
        `Doručení: ${changedOrder.delivery_address}\n\n` +
        `Děkujeme,\nFlowGo`,
    }),
  });
}

    setMessage("Status objednávky bol zmenený ✅");
  }

  async function savePickupSignature(orderId) {
  if (!pickupSigRef.current) return;

  const signature = pickupSigRef.current
    .getTrimmedCanvas()
    .toDataURL("image/png");

  const { error } = await supabase
    .from("orders")
   .update({
  pickup_signature: signature,
  pickup_signed_name: pickupSignedName,
})
    .eq("id", orderId);

  if (error) {
    setMessage("Chyba pri ukladaní podpisu");
    return;
  }

  setMessage("Podpis uložený ✅");
}

async function saveDeliverySignature(orderId) {
  if (!deliverySigRef.current) return;

  const signature = deliverySigRef.current
    .getTrimmedCanvas()
    .toDataURL("image/png");

  const { error } = await supabase
    .from("orders")
    .update({
  delivery_signature: signature,
  delivery_signed_name: deliverySignedName,
})
    .eq("id", orderId);

  if (error) {
    setMessage("Chyba pri ukladaní podpisu doručenia");
    return;
  }

  setMessage("Podpis doručenia uložený ✅");
}

  async function signUp() {
  if (!companyName || !companyIco || !authEmail || !authPassword) {
    setMessage("Vyplň názov firmy, IČO, email aj heslo.");
    return;
  }

  const { error } = await supabase.auth.signUp({
    email: authEmail,
    password: authPassword,
  });

  if (error) {
    setMessage("Chyba registrácie: " + error.message);
    return;
  }

  const { error: companyError } = await supabase
    .from("companies")
    .insert({
      email: authEmail,
      company_name: companyName,
      ico: companyIco,
    });

  if (companyError) {
    setMessage("Účet vytvorený, ale firma sa neuložila: " + companyError.message);
    return;
  }

  setMessage("Registrácia hotová. Skontroluj email.");
}

  async function signIn() {
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword,
    });

    if (error) {
      setMessage("Chyba prihlásenia: " + error.message);
    } else {
      setMessage("Prihlásenie úspešné ✅");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setScreen("order");
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        Načítavam Google Maps...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white p-6 rounded-3xl shadow-xl">
          <h1 className="text-3xl font-bold text-center text-blue-600">
            FlowGo Business
          </h1>

          <p className="text-center mt-2 text-slate-600">
            Přihlášení do profilu
          </p>

          <div className="mt-6 space-y-4">

{isRegisterMode && (
  <>
            <input
  value={companyName}
  onChange={(e) => setCompanyName(e.target.value)}
  placeholder="Názov firmy"
  className="w-full p-4 rounded-xl bg-slate-100 outline-none"
/>

<input
  value={companyIco}
  onChange={(e) => setCompanyIco(e.target.value)}
  placeholder="IČO"
  className="w-full p-4 rounded-xl bg-slate-100 outline-none"
/>
  </>
)}

            <input
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="Email"
              className="w-full p-4 rounded-xl bg-slate-100 outline-none"
            />

            <input
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="Heslo"
              type="password"
              className="w-full p-4 rounded-xl bg-slate-100 outline-none"
            />

            <button
              onClick={signIn}
              className="w-full bg-blue-600 text-white p-4 rounded-xl font-semibold"
            >
              Přihlásit se
            </button>

            <button
  onClick={() => {
    if (!isRegisterMode) {
      setIsRegisterMode(true);
      setMessage("");
      return;
    }

    signUp();
  }}
  className="w-full bg-slate-800 text-white p-4 rounded-xl font-semibold"
>
  {isRegisterMode ? "Vytvoriť účet" : "Registrovat"}
</button>
          </div>
          {isRegisterMode && (
  <button
    onClick={() => {
      setIsRegisterMode(false);
      setMessage("");
    }}
    className="w-full bg-slate-300 text-slate-800 p-4 rounded-xl font-semibold mt-2"
 >
    Späť na prihlásenie
  </button>
)}

          {message && (
            <p className="text-center font-semibold text-slate-700 mt-5">
              {message}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white p-6 rounded-3xl shadow-xl">
        <h1 className="text-3xl font-bold text-center text-blue-600">
          FlowGo Business
        </h1>

<div className="mt-4 bg-slate-100 border border-slate-200 rounded-2xl p-4">
  <p className="text-sm uppercase tracking-wide text-slate-500">
    Zákaznický účet
  </p>

  <p className="font-bold text-slate-900 mt-2">
    {companyName || "Firma"}
  </p>

  <p className="text-sm text-slate-600">
    IČO: {companyIco}
  </p>

  <p className="text-sm text-slate-600">
    {user?.email}
  </p>
</div>

       <div className="grid grid-cols-2 gap-2 mt-6">

  <button
    onClick={() => setScreen("order")}
    className="bg-blue-600 text-white p-3 rounded-xl font-semibold"
  >
    Nová objednávka
  </button>

  <button
    onClick={loadOrders}
    className="bg-slate-800 text-white p-3 rounded-xl font-semibold"
  >
    Moje objednávky
  </button>

  {isAdmin && (
    <>
      <button
        onClick={loadOrders}
        className="bg-green-600 text-white p-3 rounded-xl font-semibold"
      >
        Admin
      </button>

      <button
        onClick={loadDriverOrders}
        className="bg-yellow-500 text-white p-3 rounded-xl font-semibold"
      >
        Vodiči
      </button>
    </>
  )}

  <button
    onClick={signOut}
    className="col-span-2 bg-red-600 text-white p-3 rounded-xl font-semibold"
  >
    Odhlásit
  </button>

</div>

 {/* MAPA TRASY */}
<div className="mt-6 bg-slate-100 rounded-2xl p-4">
  <h3 className="text-lg font-bold text-slate-900">Mapa trasy</h3>
  <p className="text-slate-700 text-sm mb-3">
    Náhľad trasy medzi vyzdvihnutím a doručením.
  </p>

  {distanceKm > 0 ? (
    <iframe
      width="100%"
      height="300"
      style={{ border: 0, borderRadius: "12px" }}
      loading="lazy"
      allowFullScreen
     src={`https://www.google.com/maps/embed/v1/directions?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&origin=${encodeURIComponent(pickupAddress || "")}&destination=${encodeURIComponent(deliveryAddress || "")}&mode=driving${stops.filter(stop => stop.trim()).length > 0 ? `&waypoints=${stops.filter(stop => stop.trim()).map(stop => encodeURIComponent(stop)).join("|")}` : ""}`}
    />
  ) : (
    <div className="h-[300px] rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 text-sm text-center px-4">
      Najprv zadaj adresy a klikni na „Spočítať vzdialenosť a cenu“.
    </div>
  )}
</div>

        {screen === "order" && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="font-semibold">Vyzvednutí</label>
            
                <input
                  value={pickupAddress}
                  onChange={(e) => {
                    setPickupAddress(e.target.value);
                    setDistanceKm(0);
                  }}
                  className="w-full mt-2 p-4 rounded-xl bg-slate-100 outline-none"
                />
             
            </div>

            <div>
              <label className="font-semibold">Doručení</label>
          
                <input
                  value={deliveryAddress}
                  onChange={(e) => {
                    setDeliveryAddress(e.target.value);
                    setDistanceKm(0);
                  }}
                  className="w-full mt-2 p-4 rounded-xl bg-slate-100 outline-none"
                />
              
            </div>

{stops.map((stop, index) => (
  <div key={index} className="mt-2">
    <label className="font-semibold">
      Zastávka {index + 1}
    </label>

    <input
      value={stop}
      onChange={(e) => {
        const newStops = [...stops];
        newStops[index] = e.target.value;
        setStops(newStops);
      }}
      placeholder="Adresa zastávky"
      className="w-full mt-2 p-4 rounded-xl bg-slate-100 outline-none"
    />
  </div>
))}

            <button
  type="button"
  className="w-full bg-green-600 text-white p-3 rounded-xl font-semibold mt-2"
  onClick={() => {
  setStops([...stops, ""]);
}}
>
  + Přidat další zastávku
</button>

            <button
              onClick={calculateDistance}
              className="w-full bg-slate-800 text-white p-4 rounded-xl font-semibold"
            >
              Spočítať vzdialenosť a cenu
            </button>

            <div className="bg-blue-50 p-4 rounded-2xl">
              <p className="text-sm text-blue-700 font-semibold">
                Expresní doručení do 3 hodin
              </p>
              <p className="text-3xl font-bold text-blue-600">{price} Kč</p>
              <p className="text-sm text-slate-500">
                Vzdialenosť: {distanceKm ? distanceKm.toFixed(1) : "nezadané"} km
              </p>
            </div>

            <button
              onClick={createOrder}
              className="w-full bg-blue-600 text-white p-4 rounded-xl font-semibold"
            >
              Potvrdit objednávku • {price} Kč
            </button>
          </div>
        )}
        {screen === "orders" && (

  <div className="mt-6 space-y-3">
    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
  <p className="font-bold text-green-800">
    Objednávky tento mesiac: {monthlyOrdersCount}
  </p>

  <p className="font-bold text-green-800 mt-2">
   Tržba tento mesiac: {monthlyRevenue} Kč
  </p>
</div>

    {orders.length === 0 ? ( 
      <p className="text-center text-slate-500">
        Zatiaľ nemáš žiadne objednávky.
      </p>
    ) : (
      orders.map((order) => (
        <div
          key={order.id}
          className="bg-slate-100 p-4 rounded-2xl border border-slate-200"
        >
          <div className="flex justify-between font-bold text-slate-900">
            <div>
  
 <span>Objednávka #{order.id}</span>

  <p className="text-xs text-slate-500">
    {order.created_at
      ? new Date(order.created_at).toLocaleDateString("cs-CZ")
      : ""}
  </p>
  </div>

            <span>{order.price} Kč</span>
          </div>
          {isAdmin && (
  <div className="mt-3">
    <input
      type="number"
      defaultValue={order.price}
      id={`price-${order.id}`}
      className="w-full p-3 rounded-xl bg-slate-100 outline-none"
      placeholder="Vlastná cena"
    />

    <button
      onClick={() =>
        updateOrderPrice(
          order.id,
          document.getElementById(`price-${order.id}`).value
        )
      }
      className="mt-2 w-full bg-green-600 text-white p-3 rounded-xl font-semibold"
    >
      Uložiť vlastnú cenu
    </button>
  </div>
)}

          <p className="text-sm text-blue-600 font-semibold mt-2">
            {order.status}
          </p>

          <p className="text-sm text-slate-700 mt-2">
            {order.pickup_address}
          </p>

          <p className="text-sm text-slate-700">
            → {order.delivery_address}
          </p>

          {order.stops && (
  <p className="text-sm text-orange-600">
    🛑 {order.stops}
  </p>
)}

          <p className="text-sm text-slate-600 mt-2">
            {order.customer_name} • {order.customer_phone}
          </p>
        </div>
      ))
    )}
  </div>
)}

{screen === "driver" && (
  <div className="mt-6 space-y-3">
    {orders.length === 0 ? (
      <p className="text-center text-slate-500">
        Žiadne aktívne jazdy.
      </p>
    ) : (
      orders.map((order) => (
        <div
          key={order.id}
          className="bg-slate-100 p-4 rounded-2xl border border-slate-200"
        >
          <div className="flex justify-between font-bold text-slate-900">
            <span>Jazda #{order.id}</span>
            <span>{order.price} Kč</span>
          </div>

          <p className="text-sm text-blue-600 font-semibold mt-2">
            {order.status}
          </p>

          <p className="text-sm text-slate-700 mt-3">
            📍 {order.pickup_address}
          </p>

          <p className="text-sm text-slate-700">
            → {order.delivery_address}
          </p>

          <p className="text-sm text-slate-600 mt-2">
            {order.customer_name} • {order.customer_phone}
          </p>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              onClick={() => updateOrderStatus(order.id, "Přijato")}
              className="bg-yellow-500 text-white p-3 rounded-xl font-semibold"
            >
              Přijmout
            </button>

            <button
              onClick={() => updateOrderStatus(order.id, "Na cestě")}
              className="bg-blue-600 text-white p-3 rounded-xl font-semibold"
            >
              Na cestě
            </button>

            <button
              onClick={() => updateOrderStatus(order.id, "Doručeno")}
              className="bg-green-600 text-white p-3 rounded-xl font-semibold"
            >
              Doručeno
            </button>

            <a
              href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                order.pickup_address
              )}&destination=${encodeURIComponent(order.delivery_address)}`}
              target="_blank"
              className="bg-slate-800 text-white p-3 rounded-xl font-semibold text-center"
            >
              Navigace
            </a>

            <div className="mt-4 bg-white rounded-xl border p-3">
  <p className="font-semibold text-slate-800 mb-2">
    Podpis při vyzvednutí
  </p>

  <input
  value={pickupSignedName}
  onChange={(e) => setPickupSignedName(e.target.value)}
  placeholder="Jméno osoby při vyzvednutí"
  className="w-full p-2 mb-2 rounded-xl bg-slate-100 outline-none"
/>

  <SignatureCanvas
    ref={pickupSigRef}
    penColor="black"
    canvasProps={{
      width: 300,
      height: 150,
      className: "border rounded-xl bg-white w-full",
    }}
  />

  <button
    onClick={() => pickupSigRef.current.clear()}
    className="mt-2 bg-slate-500 text-white px-3 py-2 rounded-xl"
  >
    Vymazat podpis
  </button>

  <button
  onClick={() => savePickupSignature(order.id)}
  className="mt-2 bg-green-600 text-white px-3 py-2 rounded-xl w-full"
>
  Uložit podpis
</button>

</div>
<div className="mt-4 bg-white rounded-xl border p-3">
  <p className="font-semibold text-slate-800 mb-2">
    Podpis při doručení
  </p>

  <input
  value={deliverySignedName}
  onChange={(e) => setDeliverySignedName(e.target.value)}
  placeholder="Jméno osoby při doručení"
  className="w-full p-2 mb-2 rounded-xl bg-slate-100 outline-none"
/>

  <SignatureCanvas
    ref={deliverySigRef}
    penColor="black"
    canvasProps={{
      width: 300,
      height: 150,
      className: "border rounded-xl bg-white w-full",
    }}
  />

  <button
    onClick={() => deliverySigRef.current.clear()}
    className="mt-2 bg-slate-500 text-white px-3 py-2 rounded-xl"
  >
    Vymazat podpis
  </button>

  <button
  onClick={() => saveDeliverySignature(order.id)}
  className="mt-2 bg-green-600 text-white px-3 py-2 rounded-xl w-full"
>
  Uložit podpis
</button>

</div>

          </div>
        </div>
      ))
    )}
  </div>
)}

        {message && (
          <p className="text-center font-semibold text-slate-700 mt-5">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}