import Navbar from "@/components/home/Navbar";
import Hero from "@/components/home/Hero";
import Intro from "@/components/home/Intro";
import Collection from "@/components/home/Collection";
import Why from "@/components/home/Why";
import Beliefs from "@/components/home/Beliefs";
import Story from "@/components/home/Story";
import Approach from "@/components/home/Approach";
import FinalCta from "@/components/home/FinalCta";
import Footer from "@/components/home/Footer";
import FloatingWhatsApp from "@/components/common/FloatingWhatsApp";

export default function Home() {
  return <main id="top">
    <Navbar />
    <Hero />
    <Intro />
    <Collection />
    <Why />
    <Beliefs />
    <Story />
    <Approach />
    <FinalCta />
    <Footer />
    <FloatingWhatsApp />
  </main>;
}
