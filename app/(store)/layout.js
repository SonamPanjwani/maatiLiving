import Navbar from "@/components/home/Navbar";
import Footer from "@/components/home/Footer";
import FloatingWhatsApp from "@/components/common/FloatingWhatsApp";

// Shared chrome for inner storefront pages (the home page composes its own, over the hero).
export default function StoreLayout({ children }) {
  return <>
    <Navbar solid />
    <main className="store-main">{children}</main>
    <Footer />
    <FloatingWhatsApp />
  </>;
}
