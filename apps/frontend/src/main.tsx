import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Room from "./pages/Room";
import "./index.css";
import "leaflet/dist/leaflet.css";
import Footer from "./components/Footer";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <div className="flex flex-col min-h-screen bg-black text-white">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:code" element={<Room />} />
      </Routes>
      <Footer />
    </div>
  </BrowserRouter>,
);
