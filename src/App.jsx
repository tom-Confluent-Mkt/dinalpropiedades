import { useEffect, useRef, useState, useLayoutEffect, useMemo, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Building, MapPin, Compass, Search, Phone, Mail, ArrowRight, Menu, X, Clock, Bed, Bath, ArrowLeft, ChevronLeft, ChevronRight, Droplets, Flame, Zap, Wifi, Tv, Thermometer, Trees, Package, DoorOpen, Users, Waves, Wind, Sun, Shield, Dumbbell, Bell, Car, FileText, TrendingUp, Check, Utensils, Home as HomeIcon, Leaf, Sofa, Shirt, Star, Play } from 'lucide-react';
import sucursalBallester from './assets/Dinal-Ballester.jpg';
import sucursalSanMartin from './assets/San-martin.jpg';

const PropertyCtx = createContext({ address: null, setAddress: () => {} });

// ------------------------------------
// Cache-first data fetcher
// Tries the local JSON file written by the daily sync script first,
// then falls back to the live Tokko API if the cache is empty or stale.
// ------------------------------------
async function fetchWithCache(cacheUrl, apiUrl) {
  try {
    const res = await fetch(cacheUrl);
    if (!res.ok) throw new Error('cache miss');
    const data = await res.json();
    const arr = Array.isArray(data) ? data : (data.objects ?? []);
    if (arr.length === 0) throw new Error('empty cache');
    return arr;
  } catch {
    const res = await fetch(apiUrl);
    const data = await res.json();
    return data.objects ?? [];
  }
}

gsap.registerPlugin(ScrollTrigger);

const CONSTRUCTION_STATUS = {
  1: 'En pozo',
  2: 'En construcción',
  3: 'En pozo',
  4: 'Construcción',
  5: 'Proyecto',
  6: 'Construcción terminada',
};

function constructionLabel(status) {
  return CONSTRUCTION_STATUS[status] ?? (status ? String(status) : 'Emprendimiento');
}

// ODM developments all use status 3 (En pozo) — same base mapping, no override needed.
function odmConstructionLabel(dev) {
  return constructionLabel(dev.construction_status);
}

const TAG_TYPE_LABELS = {
  1: 'Servicios',
  2: 'Ambientes',
  3: 'Amenities',
  9: 'Características',
};

const TAG_ICONS = {
  // Servicios (type 1)
  'Agua Corriente':           <Droplets size={14} />,
  'Agua Potable':             <Droplets size={14} />,
  'Gas Natural':              <Flame size={14} />,
  'Electricidad':             <Zap size={14} />,
  'Energia trifasica':        <Zap size={14} />,
  'Losa radiante general':    <Thermometer size={14} />,
  'Cable':                    <Tv size={14} />,
  'TV Cable en el edificio':  <Tv size={14} />,
  'Internet':                 <Wifi size={14} />,
  'Alumbrado público':        <Sun size={14} />,
  'Cloaca':                   <Waves size={14} />,
  'Pavimento':                <Building size={14} />,
  // Ambientes (type 2)
  'Cocina':                   <Utensils size={14} />,
  'Jardín':                   <Trees size={14} />,
  'Lavadero':                 <Wind size={14} />,
  'Living comedor':           <Sofa size={14} />,
  'Comedor diario':           <Sofa size={14} />,
  'Patio':                    <Leaf size={14} />,
  'Terraza':                  <Sun size={14} />,
  'Balcón':                   <HomeIcon size={14} />,
  'Balcón terraza':           <HomeIcon size={14} />,
  'Vestidor':                 <Shirt size={14} />,
  'Baulera':                  <Package size={14} />,
  'Hall':                     <DoorOpen size={14} />,
  'Escritorio':               <FileText size={14} />,
  'Dependencia':              <HomeIcon size={14} />,
  'Sala de reuniones':        <Users size={14} />,
  'Altillo':                  <ArrowRight size={14} />,
  'Toilette':                 <Droplets size={14} />,
  'Galería':                  <HomeIcon size={14} />,
  'Palier':                   <DoorOpen size={14} />,
  'Oficina':                  <FileText size={14} />,
  // Amenities (type 3)
  'Parrilla':                 <Flame size={14} />,
  'Parrilla techada':         <Flame size={14} />,
  'Parrilla individual en departamento': <Flame size={14} />,
  'Quincho':                  <Flame size={14} />,
  'Pileta':                   <Waves size={14} />,
  'Pileta descubierta':       <Waves size={14} />,
  'Ascensor':                 <Building size={14} />,
  'Montacargas':              <Building size={14} />,
  'SUM':                      <Users size={14} />,
  'Club House':               <Users size={14} />,
  'Gimnasio':                 <Dumbbell size={14} />,
  'Centro de deportes':       <Dumbbell size={14} />,
  'Seguridad':                <Shield size={14} />,
  'Seguridad 24hs':           <Shield size={14} />,
  'Seguridad Privada':        <Shield size={14} />,
  'Seguridad portería':       <Shield size={14} />,
  'Seguridad de día':         <Shield size={14} />,
  'Alarma':                   <Bell size={14} />,
  'Video Cámaras':            <Bell size={14} />,
  'Preinstalación de aire acondicionado': <Wind size={14} />,
  'Aire Acondicionado individual': <Wind size={14} />,
  'Calefacción':              <Thermometer size={14} />,
  'Calefacción individual':   <Thermometer size={14} />,
  'Calefacción central':      <Thermometer size={14} />,
  'Calefacción por aire':     <Thermometer size={14} />,
  'Calefacción F/C':          <Thermometer size={14} />,
  'calefacción por aire':     <Thermometer size={14} />,
  'Caldera':                  <Thermometer size={14} />,
  'Luminoso':                 <Sun size={14} />,
  'Solarium':                 <Sun size={14} />,
  'Deck':                     <Leaf size={14} />,
  'Zonas Verdes':             <Trees size={14} />,
  'Riego automático':         <Droplets size={14} />,
  'Apto mascotas':            <Star size={14} />,
  'Apto profesional':         <Star size={14} />,
  'Cochera fija':             <Car size={14} />,
  'Cochera subterránea':      <Car size={14} />,
  'Depósito de Agua':         <Droplets size={14} />,
  'Termotanque Individual':   <Thermometer size={14} />,
  'Lavavajillas':             <Utensils size={14} />,
  'Laundry':                  <Wind size={14} />,
  'Amenities':                <Star size={14} />,
  'Barrio privado':           <Shield size={14} />,
  'Portón Corredizo':         <DoorOpen size={14} />,
  'Portones eléctricos':      <DoorOpen size={14} />,
  'Portón Levadizo':          <DoorOpen size={14} />,
  'Puerta de garaje automática': <DoorOpen size={14} />,
  'Carpintería de aluminio':  <Building size={14} />,
  'Ventanas doble acristalamiento': <Building size={14} />,
  'Doble Acristalamiento':    <Building size={14} />,
  'Ventanas de aluminio':     <Building size={14} />,
  'Hidromasaje':              <Waves size={14} />,
  'Cancha de Golf':           <Leaf size={14} />,
  'Ruta':                     <MapPin size={14} />,
  'En construcción':          <Building size={14} />,
  'Estilo Moderno':           <Star size={14} />,
  'Semi piso':                <HomeIcon size={14} />,
  'Ubicación tranquila':      <Leaf size={14} />,
  // Características (type 9)
  'Potencial alto para alquilar': <TrendingUp size={14} />,
  'Escritura inmediata':      <FileText size={14} />,
};

function slugify(str) {
  return (str ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function propSlug(item) {
  const title = item.publication_title ?? item.name ?? '';
  const addr  = item.fake_address ?? '';
  const text  = addr ? `${title} ${addr}` : title;
  return `${item.id}-${slugify(text)}`.slice(0, 100);
}

// ----------------------------------------------------
// A. NAVBAR
// ----------------------------------------------------
const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isContactPage = location.pathname === '/contacto';
  const isEmprendimientosPage = location.pathname === '/emprendimientos';
  const isAlquilerPage = location.pathname === '/alquiler';
  const isVentaPage = location.pathname === '/venta';
  const isSucursalesPage = location.pathname === '/sucursales';
  const isDetailPage = location.pathname.startsWith('/propiedad') || location.pathname.startsWith('/emprendimientos/terminado/');
  const isNosotrosPage = location.pathname === '/nosotros';
  const isObrasDeMarPage = location.pathname.startsWith('/obras-de-mar');

  const isDarkNav = scrolled || isContactPage || isEmprendimientosPage || isAlquilerPage || isVentaPage || isSucursalesPage || isDetailPage || isNosotrosPage || isObrasDeMarPage;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
    <nav className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-in-out w-[95%] max-w-7xl rounded-full px-6 py-4 flex items-center justify-between
      ${isDarkNav ? 'bg-background/90 backdrop-blur-xl border border-primary/10 shadow-lg' : 'bg-transparent text-background'}
    `}>
      <div className="flex items-center">
        {/* We use CSS invert to turn the white logo black when the navbar background turns white */}
        <Link to="/">
          <img 
            src="/logo.svg" 
            alt="Dinal Propiedades" 
            className={`h-8 transition-all duration-500 ${isDarkNav ? 'invert' : ''}`} 
          />
        </Link>
      </div>
      
      <div className={`hidden md:flex items-center gap-8 font-heading font-medium text-sm tracking-wide ${isDarkNav ? 'text-primary' : 'text-background/90'}`}>
        <Link to="/venta" className="hover:-translate-y-[1px] hover:text-accent transition-all duration-300">Venta</Link>
        <Link to="/alquiler" className="hover:-translate-y-[1px] hover:text-accent transition-all duration-300">Alquiler</Link>
        <Link to="/emprendimientos" className="hover:-translate-y-[1px] hover:text-accent transition-all duration-300">Emprendimientos</Link>
        <Link to="/sucursales" className="hover:-translate-y-[1px] hover:text-accent transition-all duration-300">Sucursales</Link>
        <Link to="/nosotros" className="hover:-translate-y-[1px] hover:text-accent transition-all duration-300">Nosotros</Link>
        {/* <Link to="/obras-de-mar" className="hover:-translate-y-[1px] hover:text-accent transition-all duration-300">Obras de Mar</Link> */}
      </div>

      <div className="hidden md:block">
        <Link to="/contacto" className={`block relative overflow-hidden group px-6 py-2.5 rounded-full font-heading font-semibold text-sm transition-colors duration-300
          ${isDarkNav ? 'border border-primary text-primary hover:border-accent hover:text-accent' : 'border border-white text-white hover:border-accent hover:text-accent'}
        `}>
          <span className="relative z-10">Contacto</span>
        </Link>
      </div>

      <button className="md:hidden z-50 relative" onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? <X size={24} className="text-primary" /> : <Menu size={24} className={isDarkNav ? "text-primary" : "text-background"} />}
      </button>
    </nav>

    {/* Mobile nav — rendered outside the transformed <nav> so position:fixed works correctly */}
    <div className={`md:hidden fixed inset-0 bg-background z-40 transition-all duration-300 ease-in-out flex flex-col justify-center items-center gap-8 ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
         <img src="/logo.svg" alt="Dinal Propiedades" className="h-10 invert mb-8" />
         <Link to="/venta" className="font-heading text-4xl text-primary hover:text-accent transition-colors" onClick={()=>setMobileOpen(false)}>Venta</Link>
         <Link to="/alquiler" className="font-heading text-4xl text-primary hover:text-accent transition-colors" onClick={()=>setMobileOpen(false)}>Alquiler</Link>
         <Link to="/emprendimientos" className="font-heading text-4xl text-primary hover:text-accent transition-colors" onClick={()=>setMobileOpen(false)}>Emprendimientos</Link>
         <Link to="/sucursales" className="font-heading text-4xl text-primary hover:text-accent transition-colors" onClick={()=>setMobileOpen(false)}>Sucursales</Link>
         <Link to="/nosotros" className="font-heading text-4xl text-primary hover:text-accent transition-colors" onClick={()=>setMobileOpen(false)}>Nosotros</Link>
         {/* <Link to="/obras-de-mar" className="font-heading text-4xl text-primary hover:text-accent transition-colors" onClick={()=>setMobileOpen(false)}>Obras de Mar</Link> */}
         <Link to="/contacto" className="font-heading text-4xl text-primary hover:text-accent transition-colors" onClick={()=>setMobileOpen(false)}>Contacto</Link>
    </div>
    </>
  );
};

// ----------------------------------------------------
// B. HERO
// ----------------------------------------------------
const Hero = () => {
  const containerRef = useRef(null);
  const [waOpen, setWaOpen] = useState(false);

  useLayoutEffect(() => {
    let ctx = gsap.context(() => {
      gsap.from(".hero-element", {
        y: 40,
        opacity: 0,
        duration: 1.2,
        stagger: 0.1,
        ease: "power3.out",
        delay: 0.2
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="relative h-[100dvh] w-full flex items-end pb-24 lg:pb-32 px-6 lg:px-12 object-cover overflow-hidden bg-primary">
      <div className="absolute inset-0 z-0">
        <img
          src="/images/Size%20Optimized/COnstrucciòn%202%20(1)%20(1).jpg"
          alt="Construcción en San Martín"
          className="w-full h-full object-cover scale-105 origin-center opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/80 to-transparent"></div>
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto">
        <h1 className="text-background flex flex-col gap-4">
          <span className="hero-element font-drama font-black text-5xl md:text-7xl lg:text-8xl leading-none md:leading-[1.1] text-white drop-shadow-md pb-2">
            <span className="font-normal">Cumplimos con Vos,</span> Siempre.
            <div className="h-1 w-24 bg-accent mt-8 mb-2"></div>
          </span>
          <span className="hero-element font-heading font-normal italic text-2xl md:text-3xl text-background/90">+80 proyectos en San Martín</span>
        </h1>
        <p className="hero-element mt-6 text-background/80 font-heading text-lg max-w-xl">
          Impulsamos tus proyectos con la energía de un equipo joven y la solidez de más de 30 años construyendo hogares de calidad.
        </p>
        <div className="hero-element mt-10">
          <a href="#propiedades" className="group inline-flex items-center gap-4 border border-white text-white px-8 py-4 rounded-full font-heading font-bold text-lg hover:border-accent hover:text-accent hover:scale-[1.02] transition-all duration-300">
            Encontrá tu propiedad
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </div>
    </section>
  );
};

// ----------------------------------------------------
// C. FEATURES
// ----------------------------------------------------
const Features = () => {
  return (
    <section className="py-32 px-6 lg:px-12 bg-[#F9FAFB] flex flex-col items-center">
      <div className="max-w-7xl w-full grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Card 1 */}
        <div className="feature-card bg-white p-8 rounded-[1rem] shadow border border-primary/20 hover:-translate-y-2 hover:border-accent transition-all duration-500 flex flex-col justify-between h-[360px] group">
          <div>
            <div className="mb-6 text-primary group-hover:text-accent transition-colors">
              <Clock size={36} strokeWidth={1.5} />
            </div>
            <h3 className="font-heading font-bold text-2xl text-primary mb-3">30+ Años de Legado</h3>
            <p className="font-heading text-dark/70 leading-relaxed">
              Solidez confirmada. Más de tres décadas construyendo confianza y hogares de calidad en el mercado inmobiliario.
            </p>
          </div>
          <div className="font-data text-dark/40 text-xs tracking-widest uppercase border-t border-primary/10 pt-4">
            // Base de Confianza
          </div>
        </div>

        {/* Card 2 */}
        <div className="feature-card bg-primary p-8 rounded-[1rem] shadow-xl border border-primary hover:-translate-y-2 hover:border-accent transition-all duration-500 flex flex-col justify-between h-[360px] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 text-white/5 top-1/2 -translate-y-1/2 right-4 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-700 pointer-events-none">
            <Compass size={160} strokeWidth={1} />
          </div>
          <div className="relative z-10">
            <div className="mb-6 text-white group-hover:text-accent transition-colors">
              <MapPin size={36} strokeWidth={1.5} />
            </div>
            <h3 className="font-heading font-bold text-2xl text-white mb-3">Experiencia Local</h3>
            <p className="font-heading text-white/70 leading-relaxed">
              Atención hiper-localizada con nuestras sucursales premium en Villa Ballester y San Martín.
            </p>
          </div>
          <div className="relative z-10 font-data text-white/40 group-hover:text-accent transition-colors text-xs tracking-widest uppercase flex items-center gap-2 border-t border-white/10 pt-4">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
            San Martín / Ballester
          </div>
        </div>

        {/* Card 3 */}
        <div className="feature-card bg-white p-8 rounded-[1rem] shadow border border-primary/20 hover:-translate-y-2 hover:border-accent transition-all duration-500 flex flex-col justify-between h-[360px] group">
          <div>
            <div className="mb-6 text-primary group-hover:text-accent transition-colors">
              <Building size={36} strokeWidth={1.5} />
            </div>
            <h3 className="font-heading font-bold text-2xl text-primary mb-3">Soluciones de Vanguardia</h3>
            <p className="font-heading text-dark/70 leading-relaxed">
              Un equipo proactivo y herramientas tecnológicas totalmente integradas para acelerar tus proyectos.
            </p>
          </div>
          <div className="font-data text-dark/40 text-xs tracking-widest uppercase border-t border-primary/10 pt-4">
            // Impulsado por Tecnología
          </div>
        </div>

      </div>
    </section>
  );
};

// ----------------------------------------------------
// D. PHILOSOPHY
// ----------------------------------------------------
const Philosophy = () => {
  const containerRef = useRef(null);

  useLayoutEffect(() => {
    let ctx = gsap.context(() => {
      gsap.from(".phil-text", {
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 60%",
        },
        y: 40,
        opacity: 0,
        duration: 1,
        stagger: 0.2,
        ease: "power2.out"
      });
      
      gsap.to(".phil-line", {
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 50%",
        },
        scaleX: 1,
        duration: 1,
        ease: "power3.inOut"
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="relative py-40 px-6 lg:px-12 bg-primary overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 opacity-10">
        <img 
          src="/images/Size%20Optimized/_MG_2515.jpg"
          alt="Texture"
          className="w-full h-full object-cover mix-blend-overlay grayscale"
        />
      </div>
      <div className="relative z-10 w-full max-w-5xl text-center flex flex-col items-center gap-8">
        <h2 className="phil-text font-heading text-2xl md:text-3xl text-background/60">
          Muchas agencias se enfocan en <span className="text-white">vender metros cuadrados.</span>
        </h2>
        
        {/* Accent line effect */}
        <div className="phil-line w-24 h-px bg-accent scale-x-0 origin-center my-4"></div>

        <h2 className="phil-text font-drama font-bold text-5xl md:text-6xl lg:text-7xl text-background leading-tight">
          Nosotros nos enfocamos en <br/> <span className="text-white italic">construir hogares.</span>
        </h2>
      </div>
    </section>
  );
};

// ----------------------------------------------------
// E. PROTOCOL / CATEGORIES (Sticky Stack)
// ----------------------------------------------------
const Categories = () => {
  const containerRef = useRef(null);

  const categories = [
    {
      title: "Casas & Departamentos",
      desc: "Espacios diseñados para habitar y disfrutar. Conectando familias con su lugar ideal en el mundo.",
      img: "/images/Size%20Optimized/_MG_1702.jpg",
      tags: ["+150 Disponibles", "A Estrenar", "Barrios Cerrados"],
      link: "/venta"
    },
    {
      title: "Alquileres",
      desc: "Opciones residenciales y comerciales con un trato transparente y asesoramiento permanente en cada paso.",
      img: "/images/Size%20Optimized/_MG_1211.jpg",
      tags: ["Residencial", "Comercial", "Con Garantía"],
      link: "/alquiler"
    },
    {
      title: "Emprendimientos",
      desc: "Invierta en el futuro. Proyectos desde el pozo y desarrollos de vanguardia con alta rentabilidad.",
      img: "/images/Size%20Optimized/COnstrucciòn%202%20(1)%20(1).jpg",
      tags: ["Pozo", "Cuotas", "Zona Norte"],
      link: "/emprendimientos"
    }
  ];

  useLayoutEffect(() => {
    let ctx = gsap.context(() => {
      const cards = gsap.utils.toArray('.category-card');
      
      cards.forEach((card, i) => {
        ScrollTrigger.create({
          trigger: card,
          start: "top top",
          pin: true,
          pinSpacing: false,
          endTrigger: containerRef.current,
          end: "bottom bottom"
        });

        if (i < cards.length - 1) {
          gsap.to(card, {
            scale: 0.95,
            filter: "blur(5px)",
            opacity: 0.6,
            scrollTrigger: {
              trigger: cards[i + 1],
              start: "top bottom",
              end: "top top",
              scrub: true,
            }
          });
        }
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="bg-background pb-[100vh]">
      {categories.map((cat, i) => (
        <div key={i} className={`category-card h-[100vh] w-full flex items-center justify-center p-6 lg:p-12 z-[${i * 10}] sticky top-0`}>
          <div className="w-full max-w-7xl h-full max-h-[800px] rounded-[1rem] bg-white overflow-hidden shadow-2xl flex flex-col md:flex-row group border border-primary/10">
            <div className="w-full md:w-1/2 p-10 lg:p-20 flex flex-col justify-center relative">
              
              <div className="absolute top-10 left-10 w-8 h-8 border-t border-l border-primary/20 group-hover:border-accent transition-colors"></div>
              
              <span className="font-data text-primary/40 font-bold tracking-widest text-xs mb-4">0{i + 1} // CATEGORÍA</span>
              <h2 className="font-drama font-bold text-4xl lg:text-6xl text-primary mb-6">{cat.title}</h2>
              <p className="font-heading text-lg text-dark/70 mb-12 max-w-md">
                {cat.desc}
              </p>
              <div className="flex flex-wrap gap-3 mb-12">
                {cat.tags.map(tag => (
                  <span key={tag} className="px-4 py-1.5 rounded-full border border-primary/20 text-xs text-primary font-semibold hover:border-accent transition-colors">
                    {tag}
                  </span>
                ))}
              </div>
              <div>
                <Link to={cat.link} className="flex items-center gap-3 font-heading font-bold text-lg text-primary hover:text-accent group-hover:translate-x-2 transition-all">
                  Explorar
                  <ArrowRight size={20} />
                </Link>
              </div>
            </div>
            <div className="w-full md:w-1/2 h-full overflow-hidden relative border-l border-primary/10">
              <img src={cat.img} alt={cat.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2s] ease-out opacity-90" />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
};

// ----------------------------------------------------
// F. REUSABLE LISTING CARDS + FEATURED SLIDER
// ----------------------------------------------------
const FALLBACK_IMG = '/images/Size%20Optimized/_MG_4841.jpg';

const StarBadge = () => (
  <span className="absolute top-8 right-8 z-10 bg-accent text-primary font-heading font-bold px-2.5 py-1 rounded-sm text-[10px] uppercase tracking-wider flex items-center gap-1">
    <Star size={11} fill="currentColor" /> Destacada
  </span>
);

const PropertyCard = ({ prop, opType, className = '' }) => {
  const op = prop.operations?.find(o => o.operation_type === opType) || prop.operations?.[0];
  const price = op && op.prices?.length > 0 ? `${op.prices[0].currency} ${op.prices[0].price}` : 'Consultar';
  return (
    <Link to={`/propiedad/${propSlug(prop)}`} className={`${className} bg-white rounded-[1rem] p-4 shadow-sm border border-primary/10 hover:shadow-xl hover:-translate-y-2 hover:border-accent transition-all duration-300 group cursor-pointer relative flex flex-col h-full block`}>
      <div className="absolute top-8 left-8 z-10 bg-primary text-white font-heading font-bold px-3 py-1 rounded-sm text-xs uppercase tracking-wider">{price}</div>
      {prop.is_starred_on_web && <StarBadge />}
      <div className="w-full h-[250px] rounded-lg overflow-hidden mb-6 relative">
        <img src={prop.photos?.[0]?.image || FALLBACK_IMG} alt={prop.publication_title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
      </div>
      <div className="px-2 flex-grow flex flex-col">
        <h3 className="font-heading font-bold text-xl text-primary mb-2 line-clamp-2">{prop.publication_title}</h3>
        <p className="font-heading text-sm text-dark/60 mb-6 flex items-center gap-2"><MapPin size={16}/> {prop.location?.name}</p>
        <div className="mt-auto pt-4 border-t border-primary/10 flex items-center justify-between text-sm font-heading">
          {prop.roofed_surface > 0 && <span className="flex items-center gap-1"><Bed size={16}/> {prop.roofed_surface}m²</span>}
          {prop.bathroom_amount > 0 && <span className="flex items-center gap-1"><Bath size={16}/> {prop.bathroom_amount} Baños</span>}
          <span className="font-bold text-primary group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 ml-auto">Ver <ArrowRight size={14} /></span>
        </div>
      </div>
    </Link>
  );
};

const DevelopmentCard = ({ dev, className = '', linkTo }) => (
  <Link to={linkTo ?? `/propiedad/${propSlug(dev)}`} className={`${className} bg-white rounded-[1rem] p-4 shadow-sm border border-primary/10 hover:shadow-xl hover:-translate-y-2 hover:border-accent transition-all duration-300 group cursor-pointer relative flex flex-col h-full block`}>
    <div className="absolute top-8 left-8 z-10 bg-primary text-white font-heading font-bold px-3 py-1 rounded-sm text-xs uppercase tracking-wider">{constructionLabel(dev.construction_status)}</div>
    {dev.is_starred_on_web && <StarBadge />}
    <div className="w-full h-[250px] rounded-lg overflow-hidden mb-6 relative">
      <img src={dev.photos?.[0]?.image || '/images/Size%20Optimized/_MG_2516.jpg'} alt={dev.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
    </div>
    <div className="px-2 flex-grow flex flex-col">
      <h3 className="font-heading font-bold text-xl text-primary mb-2 line-clamp-2">{dev.name}</h3>
      <p className="font-heading text-sm text-dark/60 mb-6 flex items-center gap-2"><MapPin size={16}/> {dev.location?.name}</p>
      <div className="mt-auto pt-4 border-t border-primary/10 flex items-center justify-between">
        <span className="font-heading font-bold text-primary">Ver Proyecto</span>
        <ArrowRight size={18} className="text-accent group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  </Link>
);

// Horizontal, swipeable slider with arrow controls (arrows appear when there's
// more than one row's worth of cards).
const FeaturedSlider = ({ items, renderItem }) => {
  const trackRef = useRef(null);
  const scrollByCard = (dir) => {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };
  if (!items.length) return null;
  return (
    <div className="relative">
      <div ref={trackRef} className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, i) => (
          <div key={item.id ?? i} className="snap-start shrink-0 w-[88%] sm:w-[46%] lg:w-[31.5%]">
            {renderItem(item)}
          </div>
        ))}
      </div>
      {items.length > 3 && (
        <>
          <button type="button" aria-label="Anterior" onClick={() => scrollByCard(-1)} className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white border border-primary/15 shadow-md items-center justify-center text-primary hover:border-accent hover:text-accent transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button type="button" aria-label="Siguiente" onClick={() => scrollByCard(1)} className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white border border-primary/15 shadow-md items-center justify-center text-primary hover:border-accent hover:text-accent transition-colors">
            <ChevronRight size={20} />
          </button>
        </>
      )}
    </div>
  );
};

const FEATURED_OPTIONS = [
  { key: 'venta', label: 'Venta' },
  { key: 'alquiler', label: 'Alquiler' },
  { key: 'emprendimientos', label: 'Emprendimientos' },
];

// ----------------------------------------------------
// G. OPORTUNIDADES — homepage featured slider
// ----------------------------------------------------
const Oportunidades = () => {
  const [properties, setProperties] = useState([]);
  const [devs, setDevs] = useState([]);
  const [tab, setTab] = useState('venta');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchWithCache('/data/properties.json', `https://tokkobroker.com/api/v1/property/?key=${import.meta.env.VITE_TOKKO_API_KEY}&lang=es_ar&format=json&limit=200`),
      fetchWithCache('/data/developments.json', `https://tokkobroker.com/api/v1/development/?key=${import.meta.env.VITE_TOKKO_API_KEY}&lang=es_ar&format=json&limit=200`),
    ]).then(([p, d]) => { setProperties(p); setDevs(d); })
      .catch(err => console.error('Oportunidades fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  // Show the starred ("destacadas") of the selected category; if none are
  // starred yet, fall back to the latest of that category so it isn't empty.
  const items = useMemo(() => {
    if (tab === 'emprendimientos') {
      const starred = devs.filter(d => d.is_starred_on_web);
      return (starred.length ? starred : devs).slice(0, 9);
    }
    const op = tab === 'venta' ? 'Venta' : 'Alquiler';
    const ofType = properties.filter(p => p.operations?.some(o => o.operation_type === op));
    const starred = ofType.filter(p => p.is_starred_on_web);
    return (starred.length ? starred : ofType).slice(0, 9);
  }, [tab, properties, devs]);

  return (
    <section id="propiedades" className="py-32 px-6 lg:px-12 bg-white relative">
      <div className="max-w-7xl mx-auto flex flex-col gap-12">

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-primary/10 pb-8">
          <div>
            <span className="font-data text-primary/40 tracking-widest text-xs mb-4 block">// DESTACADAS</span>
            <h2 className="font-heading font-bold text-4xl lg:text-5xl text-primary">Oportunidades</h2>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="oportunidades-select" className="font-data text-xs uppercase tracking-widest text-primary/40">Mostrar</label>
            <select
              id="oportunidades-select"
              value={tab}
              onChange={e => setTab(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-primary/15 font-heading font-semibold text-sm text-primary bg-white focus:outline-none focus:border-accent transition-colors"
            >
              {FEATURED_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="animate-pulse bg-background p-4 rounded-[1rem] h-[400px] border border-primary/10">
                <div className="bg-dark/10 w-full h-[240px] rounded-lg"></div>
                <div className="mt-4 bg-dark/10 h-6 w-1/2 rounded"></div>
                <div className="mt-2 bg-dark/10 h-4 w-1/3 rounded"></div>
              </div>
            ))}
          </div>
        ) : items.length > 0 ? (
          <FeaturedSlider
            items={items}
            renderItem={item => tab === 'emprendimientos'
              ? <DevelopmentCard dev={item} />
              : <PropertyCard prop={item} opType={tab === 'venta' ? 'Venta' : 'Alquiler'} />}
          />
        ) : (
          <p className="text-center py-20 font-heading text-xl text-dark/50">
            No hay oportunidades en esta categoría por ahora.
          </p>
        )}

        <div className="flex justify-center">
          <Link to={tab === 'emprendimientos' ? '/emprendimientos' : `/${tab}`} className="text-primary border-b border-primary hover:border-accent hover:text-accent transition-colors font-heading font-bold pb-1">
            Ver todo en {FEATURED_OPTIONS.find(o => o.key === tab)?.label}
          </Link>
        </div>
      </div>
    </section>
  );
};

// ----------------------------------------------------
// G. CONTACT
// ----------------------------------------------------
const Contact = () => {
  const containerRef = useRef(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', reason: '', message: '' });
  const [submitStatus, setSubmitStatus] = useState('idle');
  const [waOpen, setWaOpen] = useState(false); // idle | sending | success | error

  const handleField = e => setFormData(f => ({ ...f, [e.target.id]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitStatus('sending');
    try {
      const res = await fetch(
        `https://tokkobroker.com/api/v1/property/contact/?key=${import.meta.env.VITE_TOKKO_API_KEY}&format=json`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            message: `[${formData.reason || 'Consulta general'}] ${formData.message}`,
            tags: ['Web', 'Contacto'],
          }),
        }
      );
      if (!res.ok) throw new Error();
      setSubmitStatus('success');
      setFormData({ name: '', email: '', phone: '', reason: '', message: '' });
    } catch {
      setSubmitStatus('error');
    }
  };

  useLayoutEffect(() => {
    let ctx = gsap.context(() => {
      gsap.from(".contact-elem", {
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 70%",
        },
        y: 40,
        opacity: 0,
        duration: 1.2,
        stagger: 0.1,
        ease: "power3.out"
      });
      gsap.from(".contact-img", {
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 70%",
        },
        scale: 1.05,
        opacity: 0,
        duration: 2,
        ease: "power3.out"
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="min-h-[100dvh] pt-40 pb-32 px-6 lg:px-12 bg-[#F9FAFB] text-primary overflow-hidden relative flex flex-col justify-center">
      
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 relative z-10 items-center">
        
        {/* Left Col - Content & Form */}
        <div className="flex flex-col justify-center lg:py-10">
          <div className="mb-12">
            <span className="contact-elem font-data tracking-widest text-xs text-primary/40 mb-6 flex items-center gap-4">
              <div className="h-px w-8 bg-accent"></div>
              HABLEMOS
            </span>
            <h2 className="contact-elem font-drama text-5xl md:text-6xl mb-6 leading-tight text-primary">
               Estamos acá para <br/>
               <span className="font-heading font-medium italic text-primary tracking-tight">asesorarte.</span>
            </h2>
            <p className="contact-elem font-heading text-dark/70 max-w-md leading-relaxed">
              Ya sea para tasar, vender, alquilar o invertir. Dejanos tu mensaje y un asesor especializado se pondrá en contacto con vos a la brevedad.
            </p>
          </div>

          <form className="contact-elem bg-white p-8 md:p-10 rounded-[2rem] border border-primary/10 shadow-xl relative group w-full" onSubmit={handleSubmit}>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="relative">
                <input type="text" id="name" value={formData.name} onChange={handleField} className="peer w-full bg-transparent border-b border-primary/20 text-primary py-2 outline-none font-heading text-lg focus:border-accent transition-colors placeholder-transparent" placeholder="Nombre completo" required />
                <label htmlFor="name" className="absolute left-0 -top-4 text-xs font-heading text-dark/50 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-2 peer-focus:-top-4 peer-focus:text-xs peer-focus:text-accent cursor-text">Nombre completo</label>
              </div>
              <div className="relative">
                <input type="email" id="email" value={formData.email} onChange={handleField} className="peer w-full bg-transparent border-b border-primary/20 text-primary py-2 outline-none font-heading text-lg focus:border-accent transition-colors placeholder-transparent" placeholder="Correo electrónico" required />
                <label htmlFor="email" className="absolute left-0 -top-4 text-xs font-heading text-dark/50 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-2 peer-focus:-top-4 peer-focus:text-xs peer-focus:text-accent cursor-text">Correo electrónico</label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              <div className="relative">
                <input type="tel" id="phone" value={formData.phone} onChange={handleField} className="peer w-full bg-transparent border-b border-primary/20 text-primary py-2 outline-none font-heading text-lg focus:border-accent transition-colors placeholder-transparent" placeholder="Teléfono" />
                <label htmlFor="phone" className="absolute left-0 -top-4 text-xs font-heading text-dark/50 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-2 peer-focus:-top-4 peer-focus:text-xs peer-focus:text-accent cursor-text">Teléfono</label>
              </div>
              <div className="relative">
                <select id="reason" value={formData.reason} onChange={handleField} className="w-full bg-transparent border-b border-primary/20 text-primary py-2 outline-none font-heading text-lg focus:border-accent transition-colors appearance-none cursor-pointer">
                  <option value="" className="text-dark/50">Motivo de consulta...</option>
                  <option value="tasacion" className="text-primary">Tasación</option>
                  <option value="compra" className="text-primary">Comprar propiedad</option>
                  <option value="alquiler" className="text-primary">Alquilar propiedad</option>
                  <option value="emprendimiento" className="text-primary">Desarrollos / Emprendimientos</option>
                  <option value="otro" className="text-primary">Otro</option>
                </select>
              </div>
            </div>

            <div className="relative mb-12">
              <textarea id="message" value={formData.message} onChange={handleField} rows="2" className="peer w-full bg-transparent border-b border-primary/20 text-primary py-2 outline-none font-heading text-lg focus:border-accent transition-colors placeholder-transparent resize-none" placeholder="Mensaje" required></textarea>
              <label htmlFor="message" className="absolute left-0 -top-4 text-xs font-heading text-dark/50 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-2 peer-focus:-top-4 peer-focus:text-xs peer-focus:text-accent cursor-text">Tu mensaje</label>
            </div>

            {submitStatus === 'success' && (
              <div className="mb-4 bg-accent/20 border border-accent/40 text-primary font-heading text-sm px-4 py-3 rounded-xl">
                ¡Mensaje enviado! Nos pondremos en contacto a la brevedad.
              </div>
            )}
            {submitStatus === 'error' && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-600 font-heading text-sm px-4 py-3 rounded-xl">
                Hubo un error al enviar. Intentá de nuevo o contactanos por WhatsApp.
              </div>
            )}
            <button type="submit" disabled={submitStatus === 'sending'} className="w-full bg-primary border-2 border-transparent hover:border-accent disabled:opacity-60 text-white font-heading font-bold text-lg py-4 rounded-xl flex items-center justify-center gap-3 transition-colors duration-300 transform hover:scale-[1.02]">
              {submitStatus === 'sending' ? 'Enviando…' : 'Enviar mensaje'}
              {submitStatus !== 'sending' && <ArrowRight size={20} />}
            </button>
          </form>
          
          <div className="contact-elem grid grid-cols-2 gap-8 mt-12 w-full max-w-xl border-t border-primary/10 pt-8">
            <div>
              <h4 className="font-heading font-bold text-primary mb-1 uppercase text-sm tracking-wider">Villa Ballester</h4>
              <p className="font-heading text-dark/60 text-sm flex flex-col gap-1">
                Almirante Brown 3295 <br/>
                <a href="tel:+5491177170405" className="hover:text-accent font-medium transition-colors">+54 9 11 7717-0405</a>
              </p>
            </div>
            <div>
              <h4 className="font-heading font-bold text-primary mb-1 uppercase text-sm tracking-wider">San Martín</h4>
              <p className="font-heading text-dark/60 text-sm flex flex-col gap-1">
                Mitre 3404 <br/>
                <a href="tel:+5491177176007" className="hover:text-accent font-medium transition-colors">+54 9 11 7717-6007</a>
              </p>
            </div>
          </div>
          
          <div className="contact-elem mt-6">
            <a href="mailto:info@dinalpropiedades.com" className="font-heading font-medium text-primary hover:text-accent transition-colors flex items-center gap-2 text-sm">
              <Mail size={16}/> info@dinalpropiedades.com
            </a>
          </div>
        </div>

        {/* Right Col - Image */}
        <div className="h-full min-h-[500px] w-full relative contact-img lg:pl-10 hidden md:block">
           <div className="absolute top-10 right-10 bottom-10 left-0 bg-primary/5 rounded-[2rem] -z-10 transform translate-x-4 translate-y-4"></div>
           <img
               src="/images/Size%20Optimized/_MG_1702.jpg"
               alt="Edificio Moderno"
               className="w-full h-full object-cover rounded-[2rem] shadow-2xl"
           />
           {/* Floating WhatsApp Tag */}
           <div className="absolute -left-6 bottom-16 hidden lg:block">
             {waOpen && (
               <div className="absolute bottom-full mb-3 left-0 bg-white rounded-2xl shadow-2xl border border-primary/10 p-3 flex flex-col gap-2 min-w-[220px]">
                 <a href={`https://wa.me/5491177170405?text=${encodeURIComponent('Hola, quería más información.')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#25D366]/10 text-primary font-heading font-semibold text-sm transition-colors whitespace-nowrap">
                   {WA_SVG} Villa Ballester
                 </a>
                 <a href={`https://wa.me/5491177176007?text=${encodeURIComponent('Hola, quería más información.')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#25D366]/10 text-primary font-heading font-semibold text-sm transition-colors whitespace-nowrap">
                   {WA_SVG} San Martín
                 </a>
               </div>
             )}
             <button onClick={() => setWaOpen(o => !o)} className="bg-white p-6 rounded-2xl shadow-xl border border-primary/5 animate-bounce cursor-pointer hover:shadow-2xl transition-shadow" style={{animationDuration: '3s'}}>
               <div className="flex items-center gap-4">
                 <div className="bg-primary/5 p-3 rounded-full text-[#25D366]">
                   <svg viewBox="0 0 24 24" width={32} height={32} fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                 </div>
                 <div className="text-left">
                   <p className="font-data text-[10px] text-dark/40 tracking-widest uppercase mb-1">Respuesta Inmediata</p>
                   <p className="font-heading font-bold text-primary">Chat en línea</p>
                 </div>
               </div>
             </button>
           </div>
        </div>

      </div>
    </section>
  );
};

// ----------------------------------------------------
// H. FOOTER
// ----------------------------------------------------
const Footer = () => {
  return (
    <footer className="bg-primary text-background px-6 lg:px-12 pt-24 pb-8 border-t-[8px] border-accent relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
          
          <div className="md:col-span-2">
            <img src="/logo.svg" alt="Dinal Propiedades" className="h-10 mb-8" />
            <p className="font-heading text-background/60 max-w-sm mb-8">
              Impulsamos tus proyectos con la energía de un equipo joven y la solidez de más de 30 años construyendo hogares de calidad.
            </p>
            <div className="flex items-center gap-3 border border-white/20 px-4 py-2 rounded-sm w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
              <span className="font-data text-xs text-background/80 uppercase">Atención activa de 10 a 13 y de 14 a 18 hs</span>
            </div>
          </div>

          <div>
            <h4 className="font-data border-l-2 border-accent pl-3 text-white text-xs tracking-widest mb-6">SUCURSALES</h4>
            <ul className="flex flex-col gap-6 font-heading text-background/60">
              <li>
                <strong className="text-white block font-medium mb-1">Villa Ballester</strong>
                Almirante Brown 3295
              </li>
              <li>
                <strong className="text-white block font-medium mb-1">San Martín</strong>
                Mitre 3404
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-data border-l-2 border-accent pl-3 text-white text-xs tracking-widest mb-6">CONTACTO</h4>
            <ul className="flex flex-col gap-4 font-heading text-background/60">
              <li className="flex items-center gap-3"><a href="tel:+5491177170405" className="flex items-center gap-3 hover:text-accent transition-colors"><Phone size={16}/> +54 9 11 7717-0405</a></li>
              <li className="flex items-center gap-3"><a href="tel:+5491177176007" className="flex items-center gap-3 hover:text-accent transition-colors"><Phone size={16}/> +54 9 11 7717-6007</a></li>
              <li className="flex items-center gap-3 mt-2"><a href="mailto:info@dinalpropiedades.com" className="flex items-center gap-3 hover:text-accent transition-colors"><Mail size={16}/> info@dinalpropiedades.com</a></li>
            </ul>
          </div>

        </div>

        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/10 text-background/40 font-heading text-sm">
          <p>© {new Date().getFullYear()} Dinal Propiedades. Todos los derechos reservados.</p>
          <div className="flex gap-6 mt-4 md:mt-0 font-data text-xs tracking-widest uppercase">
            <a href="#" className="hover:text-accent transition-colors">Instagram</a>
            <a href="#" className="hover:text-accent transition-colors">Facebook</a>
            <a href="#" className="hover:text-accent transition-colors">LinkedIn</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

// ----------------------------------------------------
// I. EMPRENDIMIENTOS PAGE
// ----------------------------------------------------
const T = '/images/terminados/';
const STATIC_TERMINADOS = [
  {
    id: 'yapeyu-1850',
    name: 'Yapeyú 1850',
    location: 'San Martín, Pdo. de San Martín',
    address: 'Yapeyú 1850, entre Lincoln y Moreno, a 200m de Av. 25 de Mayo',
    construction_status: 6,
    _isStatic: true,
    photos: [
      { image: `${T}yapeyu-1850_balcon.webp`, label: 'Balcón con parrilla' },
      { image: `${T}yapeyu-1850_bano.webp`, label: 'Baño completo' },
      { image: `${T}yapeyu-1850_living.webp`, label: 'Living comedor' },
      { image: `${T}yapeyu-1850_cocina.webp`, label: 'Cocina equipada' },
      { image: `${T}yapeyu-1850_dormitorio.webp`, label: 'Dormitorio con placard' },
      { image: `${T}yapeyu-1850_terraza.webp`, label: 'Terraza con parrilla' },
    ],
    specs: '8 pisos con terraza verde y parrilla',
    units: 'Unidades de 2 y 3 ambientes',
    sqm: 'De 45 a 88.95 m²',
    price: 'USD 70.000 – 130.000',
    features: ['Balcones con piso deck y parrilla exclusiva', 'Baño y cocina con muebles completos', 'Amplio living – comedor', 'Dormitorios con frente de placard en 2 puertas de piso a techo', 'Unidades del último piso con terraza propia'],
    construction: [
      { title: 'Paredes', items: ['Mampostería divisoria en ladrillo cerámico hueco', 'Exteriores con doble muro de ladrillo hueco y hormigón armado', 'Terminaciones exteriores con pintura plástica tipo tarquini', 'Interiores con terminación en yeso', 'Baño con cerámica del piso al techo'] },
      { title: 'Pisos y Cielorrasos', items: ['Cielorrasos en yeso armado o aplicado', 'Pisos porcelanato de primera calidad', 'Dormitorios con porcelanato símil madera'] },
      { title: 'Aberturas', items: ['Ventanas de aluminio', 'Puertas placa en interiores'] },
      { title: 'Detalles', items: ['Termo de agua caliente y cocina eléctricos', 'Instalación para aire acondicionado en estar y dormitorio', 'Portero eléctrico con cámara visor'] },
    ],
    sustainability: ['Paneles solares para espacios comunes', 'Estaciones de carga para autos eléctricos', 'Sistema de riego con captación de agua de lluvia', 'Cestos de reciclaje', 'Doble muro de ladrillo con cámara de aire', 'Aberturas de doble vidrio (DVH)'],
    nearby: ['Estación de ferrocarril línea Mitre', 'Hospital Italiano sede San Martín', 'Universidad Nacional de San Martín', 'Plaza San Martín', 'Club Atlético Gral. San Martín', 'Sanatorio Modelo de Caseros'],
    brochure: 'https://grupodinal.com/wp-content/uploads/2025/01/Brochure-Yapeyu-1850-web.pdf',
    video: 'https://youtu.be/JzmBuIE_NGk',
  },
  {
    id: 'rivadavia-3869',
    name: 'Rivadavia 3869',
    location: 'San Martín, Pdo. de San Martín',
    address: 'Rivadavia 3869, entre Tucumán y San Lorenzo, a 400m de Av. Ricardo Balbín',
    construction_status: 6,
    _isStatic: true,
    photos: [
      { image: `${T}rivadavia-3869_balcon.webp`, label: 'Balcón con parrilla' },
      { image: `${T}rivadavia-3869_bano.webp`, label: 'Baño completo' },
      { image: `${T}rivadavia-3869_living.webp`, label: 'Living comedor' },
      { image: `${T}rivadavia-3869_cocina.webp`, label: 'Cocina equipada' },
    ],
    specs: '8 pisos con terraza verde y parrilla',
    units: 'Unidades de 2 y 3 ambientes',
    sqm: 'De 50.35 a 70.60 m²',
    price: 'USD 1.500/m²',
    features: ['Balcones con piso deck y parrilla', 'Baño y cocina con muebles completos', 'Living comedor con cocina integrada', 'Frente de placard en 2 puertas de piso a techo', 'Jardines exteriores verticales', 'SUM (salón de usos múltiples)'],
    construction: [
      { title: 'Paredes', items: ['Mampostería divisoria en ladrillo cerámico hueco', 'Exteriores con doble muro de ladrillo hueco y hormigón armado', 'Terminaciones exteriores con pintura plástica tipo tarquini', 'Interiores con terminación en yeso', 'Baño con cerámica del piso al techo'] },
      { title: 'Pisos y Cielorrasos', items: ['Cielorrasos en yeso armado o aplicado', 'Pisos porcelanato de primera calidad', 'Dormitorios con porcelanato símil madera'] },
      { title: 'Aberturas', items: ['Ventanas de aluminio', 'Puertas placa en interiores'] },
      { title: 'Detalles', items: ['Termo de agua caliente y cocina eléctricos', 'Instalación para aire acondicionado en estar y dormitorio', 'Portero eléctrico con cámara visor'] },
    ],
    sustainability: ['Paneles solares para espacios comunes', 'Jardines exteriores verticales', 'Sistema de riego con captación de agua de lluvia', 'Cestos de reciclaje', 'Doble muro de ladrillo con cámara de aire', 'Aberturas de doble vidrio (DVH)', 'Estaciones de carga para autos eléctricos'],
    nearby: ['Plaza San Martín', 'Hospital Italiano sede San Martín', 'Hospital Municipal Dr. Diego Thompson', 'Universidad Nacional de San Martín'],
    brochure: 'https://grupodinal.com/wp-content/uploads/2024/05/BROCHURE-RIVADAVIA-3869.pdf',
    video: null,
  },
  {
    id: 'ayacucho-2236',
    name: 'Ayacucho 2236',
    location: 'San Martín, Pdo. de San Martín',
    address: 'Ayacucho 2236, entre Pueyrredón y Matheu, acceso General Paz',
    construction_status: 6,
    _isStatic: true,
    photos: [
      { image: `${T}ayacucho-2236_bano.webp`, label: 'Baño completo' },
      { image: `${T}ayacucho-2236_living.webp`, label: 'Living comedor' },
      { image: `${T}ayacucho-2236_cocina.webp`, label: 'Cocina equipada' },
      { image: `${T}ayacucho-2236_dormitorio.webp`, label: 'Dormitorio con placard' },
      { image: `${T}ayacucho-2236_terraza.webp`, label: 'Terraza con parrilla' },
      { image: `${T}ayacucho-2236_calidad.webp`, label: 'Calidad constructiva' },
    ],
    specs: '2 pisos de oficinas + 8 de departamentos',
    units: 'Unidades de 2 y 3 ambientes',
    sqm: 'De 42 a 76.2 m²',
    price: 'USD 75.000 – 135.000',
    features: ['Balcón con piso deck', 'Baño y cocina con muebles completos', 'Cocina integrada al living', 'Frente de placard en 2 puertas de piso a techo'],
    construction: [
      { title: 'Paredes', items: ['Mampostería divisoria en ladrillo cerámico hueco', 'Exteriores con doble muro de ladrillo hueco y hormigón armado', 'Terminaciones exteriores con pintura plástica tipo tarquini', 'Interiores con terminación en yeso', 'Baño con cerámica del piso al techo'] },
      { title: 'Pisos y Cielorrasos', items: ['Cielorrasos en yeso armado o aplicado', 'Pisos porcelanato de primera calidad', 'Dormitorios con porcelanato símil madera'] },
      { title: 'Aberturas', items: ['Ventanas de aluminio', 'Puertas placa en interiores'] },
      { title: 'Detalles', items: ['Termo de agua caliente y cocina eléctricos', 'Instalación para aire acondicionado en estar y dormitorio', 'Portero eléctrico con cámara visor'] },
    ],
    sustainability: ['Paneles solares para espacios comunes', 'Sistema de riego con captación de agua de lluvia', 'Doble muro de ladrillo con cámara de aire', 'Aberturas de doble vidrio (DVH)', 'Cestos de reciclaje'],
    nearby: ['Estación de ferrocarril línea Mitre', 'Hospital Italiano sede San Martín', 'Universidad Nacional de San Martín', 'Instituto Maipú'],
    brochure: 'https://grupodinal.com/wp-content/uploads/2024/05/BROCHURE-AYACUCHO-2236.pdf',
    video: 'https://www.youtube.com/watch?v=fA9byGeCi0w',
  },
  {
    id: 'mitre-3565',
    name: 'Mitre 3565',
    location: 'San Martín, Pdo. de San Martín',
    address: 'Bartolomé Mitre 3565, entre Cerrito y Salguero, a 200m de Plaza San Martín',
    construction_status: 6,
    _isStatic: true,
    photos: [
      { image: `${T}mitre-3565_balcon.webp`, label: 'Balcón con parrilla' },
      { image: `${T}mitre-3565_bano.webp`, label: 'Baño completo' },
      { image: `${T}mitre-3565_living.webp`, label: 'Living comedor' },
      { image: `${T}mitre-3565_cocina.webp`, label: 'Cocina equipada' },
      { image: `${T}mitre-3565_dormitorio.webp`, label: 'Dormitorio con placard' },
      { image: `${T}mitre-3565_terraza.webp`, label: 'Terraza con parrilla' },
      { image: `${T}mitre-3565_sum.webp`, label: 'SUM' },
    ],
    specs: '9 pisos con terraza verde y parrilla · 2 SUM independientes',
    units: 'Unidades de 2 y 3 ambientes',
    sqm: 'De 51.30 a 87.25 m²',
    price: 'USD 84.000 – 110.000',
    features: ['Balcones con piso deck y parrilla exclusiva', 'Baño y cocina con muebles completos', 'Amplio living – comedor', 'Dormitorios con frente de placard en 2 puertas de piso a techo', 'Dos SUM independientes conectados entre sí'],
    construction: [
      { title: 'Paredes', items: ['Mampostería divisoria en ladrillo cerámico hueco', 'Exteriores con doble muro de ladrillo hueco y hormigón armado', 'Terminaciones exteriores con pintura plástica tipo tarquini', 'Interiores con terminación en yeso', 'Baño con cerámica del piso al techo'] },
      { title: 'Pisos y Cielorrasos', items: ['Cielorrasos en yeso armado o aplicado', 'Pisos porcelanato de primera calidad', 'Dormitorios con porcelanato símil madera'] },
      { title: 'Aberturas', items: ['Ventanas de aluminio', 'Puertas placa en interiores'] },
      { title: 'Detalles', items: ['Termo de agua caliente y cocina eléctricos', 'Instalación para aire acondicionado en estar y dormitorio', 'Portero eléctrico con cámara visor'] },
    ],
    sustainability: ['Paneles solares para espacios comunes', 'Estaciones de carga para autos eléctricos', 'Sistema de riego con captación de agua de lluvia', 'Cestos de reciclaje', 'Doble muro de ladrillo con cámara de aire', 'Jardines exteriores verticales', 'Aberturas de doble vidrio (DVH)'],
    nearby: ['Municipalidad de San Martín', 'Plaza San Martín', 'Universidad Nacional de San Martín', 'Liceo Superior de Cultura Inglesa', 'Estación de ferrocarril línea Mitre'],
    brochure: 'https://grupodinal.com/wp-content/uploads/2024/05/BROCHURE-2024-MITRE-3565.pdf',
    video: 'https://www.youtube.com/watch?v=hg0XlxuTCEQ',
  },
  {
    id: 'pueyrredon-3175',
    name: 'Pueyrredón 3175',
    location: 'San Martín, Pdo. de San Martín',
    address: 'Pueyrredón 3175, entre Riobamba y Las Heras, a 100m de Ayacucho',
    construction_status: 6,
    _isStatic: true,
    photos: [
      { image: `${T}pueyrredon-3175_balcon.webp`, label: 'Balcón con parrilla' },
      { image: `${T}pueyrredon-3175_bano.webp`, label: 'Baño completo' },
      { image: `${T}pueyrredon-3175_living.webp`, label: 'Living comedor' },
      { image: `${T}pueyrredon-3175_cocina.webp`, label: 'Cocina equipada' },
      { image: `${T}pueyrredon-3175_dormitorio.webp`, label: 'Dormitorio con placard' },
      { image: `${T}pueyrredon-3175_paneles.webp`, label: 'Paneles solares' },
      { image: `${T}pueyrredon-3175_terraza.webp`, label: 'Terraza con parrilla' },
    ],
    specs: '5 pisos con terraza verde y parrilla · Cocheras en planta baja',
    units: 'Unidades de 2 ambientes',
    sqm: 'Desde 49.85 m²',
    price: 'USD 68.000 – 72.000',
    features: ['Balcones con piso deck y parrilla exclusiva', 'Baño y cocina con muebles completos', 'Amplio living – comedor', 'Dormitorios con frente de placard con 2 puertas de piso a techo', 'Cocheras disponibles'],
    construction: [
      { title: 'Paredes', items: ['Mampostería divisoria en ladrillo cerámico hueco', 'Exteriores con doble muro de ladrillo hueco y hormigón armado', 'Terminaciones exteriores con pintura plástica tipo tarquini', 'Interiores con terminación en yeso', 'Baño con cerámica del piso al techo'] },
      { title: 'Pisos y Cielorrasos', items: ['Cielorrasos en yeso armado o aplicado', 'Pisos porcelanato de primera calidad', 'Dormitorios con porcelanato símil madera'] },
      { title: 'Aberturas', items: ['Ventanas de aluminio', 'Puertas placa en interiores'] },
      { title: 'Detalles', items: ['Termo de agua caliente y cocina eléctricos', 'Instalación para aire acondicionado en estar y dormitorio', 'Portero eléctrico con cámara visor'] },
    ],
    sustainability: ['Paneles solares para espacios comunes', 'Sistema de riego con captación de agua de lluvia', 'Aberturas de doble vidrio (DVH)', 'Cestos de reciclaje', 'Doble muro de ladrillo con cámara de aire'],
    nearby: ['Estación de ferrocarril línea Mitre', 'Estadio Chacarita Juniors', 'Club Atlético Tres de Febrero', 'Instituto Maipú'],
    brochure: 'https://grupodinal.com/wp-content/uploads/2024/05/BROCHURE-2024-PUERYREDON-3175.pdf',
    video: null,
  },
  {
    id: 'pueyrredon-3445',
    name: 'Pueyrredón 3445',
    location: 'San Martín, Pdo. de San Martín',
    address: 'Pueyrredón 3445, entre Cochabamba y Cerrito, a 150m de Ayacucho',
    construction_status: 6,
    _isStatic: true,
    photos: [
      { image: `${T}pueyrredon-3445_balcon.webp`, label: 'Balcón con parrilla' },
      { image: `${T}pueyrredon-3445_bano.webp`, label: 'Baño completo' },
      { image: `${T}pueyrredon-3445_living.webp`, label: 'Living comedor' },
      { image: `${T}pueyrredon-3445_cocina.webp`, label: 'Cocina equipada' },
      { image: `${T}pueyrredon-3445_dormitorio.webp`, label: 'Dormitorio con placard' },
      { image: `${T}pueyrredon-3445_terraza.webp`, label: 'Terraza' },
      { image: `${T}pueyrredon-3445_cocheras.webp`, label: 'Cocheras' },
    ],
    specs: '8 pisos con terraza y parrilla',
    units: 'Monoambiente y 2 ambientes',
    sqm: 'De 46.30 a 67.85 m²',
    price: 'USD 70.000 – 92.000',
    features: ['Balcones con piso deck y parrilla exclusiva', 'Baño y cocina con muebles completos', 'Amplio living – comedor', 'Dormitorios con frente de placard con 2 puertas de piso a techo', 'Cocheras disponibles'],
    construction: [
      { title: 'Paredes', items: ['Mampostería divisoria en ladrillo cerámico hueco', 'Exteriores con doble muro de ladrillo hueco y hormigón armado', 'Terminaciones exteriores con pintura plástica tipo tarquini', 'Interiores con terminación en yeso', 'Baño con cerámica del piso al techo'] },
      { title: 'Pisos y Cielorrasos', items: ['Cielorrasos en yeso armado o aplicado', 'Pisos porcelanato de primera calidad', 'Dormitorios con porcelanato símil madera'] },
      { title: 'Aberturas', items: ['Ventanas de aluminio', 'Puertas placa en interiores'] },
      { title: 'Detalles', items: ['Termo de agua caliente y cocina eléctricos', 'Instalación para aire acondicionado en estar y dormitorio', 'Portero eléctrico con cámara visor'] },
    ],
    sustainability: ['Paneles solares para espacios comunes', 'Doble muro de ladrillo con cámara de aire', 'Sistema de riego con captación de agua de lluvia', 'Cestos de reciclaje', 'Aberturas de doble vidrio (DVH)'],
    nearby: ['Estación de ferrocarril línea Mitre', 'Hospital Italiano sede San Martín', 'Colegio Estados Unidos', 'Universidad Nacional de San Martín'],
    brochure: 'https://grupodinal.com/wp-content/uploads/2024/05/BROCHURE-PUEYRREDON-3445.pdf',
    video: 'https://www.youtube.com/watch?v=w4KIz5MUeIY',
  },
  {
    id: 'lincoln-3967',
    name: 'Lincoln 3967',
    location: 'San Martín, Pdo. de San Martín',
    address: 'Lincoln 3967, a 300m de Av. Ricardo Balbín',
    construction_status: 6,
    _isStatic: true,
    photos: [
      { image: `${T}lincoln-3967_balcon.webp`, label: 'Balcón con parrilla' },
      { image: `${T}lincoln-3967_bano.webp`, label: 'Baño completo' },
      { image: `${T}lincoln-3967_living.webp`, label: 'Living comedor' },
      { image: `${T}lincoln-3967_cocina.webp`, label: 'Cocina equipada' },
      { image: `${T}lincoln-3967_dormitorio.webp`, label: 'Dormitorio con placard' },
      { image: `${T}lincoln-3967_terraza.webp`, label: 'Terraza con parrilla' },
      { image: `${T}lincoln-3967_calidad.webp`, label: 'Calidad constructiva' },
    ],
    specs: '7 pisos con terraza verde y parrilla',
    units: 'Unidades de 2 y 3 ambientes',
    sqm: 'De 50.70 a 105.65 m²',
    price: 'USD 80.000 – 163.000',
    features: ['Balcones con piso deck y parrilla exclusiva', 'Baño y cocina con muebles completos', 'Amplio living – comedor', 'Dormitorios con frente de placard con 2 puertas de piso a techo'],
    construction: [
      { title: 'Paredes', items: ['Mampostería divisoria en ladrillo cerámico hueco', 'Exteriores con doble muro de ladrillo hueco y hormigón armado', 'Terminaciones exteriores con pintura plástica tipo tarquini', 'Interiores con terminación en yeso', 'Baño con cerámica del piso al techo'] },
      { title: 'Pisos y Cielorrasos', items: ['Cielorrasos en yeso armado o aplicado', 'Pisos porcelanato de primera calidad', 'Dormitorios con porcelanato símil madera'] },
      { title: 'Aberturas', items: ['Ventanas de aluminio', 'Puertas placa en interiores'] },
      { title: 'Detalles', items: ['Termo de agua caliente y cocina eléctricos', 'Instalación para aire acondicionado en estar y dormitorio', 'Portero eléctrico con cámara visor'] },
    ],
    sustainability: ['Paneles solares para espacios comunes', 'Sistema de riego con captación de agua de lluvia', 'Cestos de reciclaje', 'Doble muro de ladrillo con cámara de aire', 'Aberturas de doble vidrio (DVH)'],
    nearby: ['Plaza Kennedy', 'Sanatorio Anchorena', 'Universidad Nacional de San Martín', 'Escuela Secundaria Ing. Emilio Mitre', 'Club Atlético Gral. San Martín'],
    brochure: 'https://grupodinal.com/wp-content/uploads/2025/04/Brochure-Lincoln-3967.pdf',
    video: 'https://youtu.be/WDBhzAk0NUI',
  },
  {
    id: 'cochabamba-2137',
    name: 'Cochabamba 2137',
    location: 'San Martín, Pdo. de San Martín',
    address: 'Cochabamba 2137, a 100m de Av. 25 de Mayo',
    construction_status: 6,
    _isStatic: true,
    photos: [
      { image: `${T}cochabamba-2137_balcon.webp`, label: 'Balcón con parrilla' },
      { image: `${T}cochabamba-2137_bano.webp`, label: 'Baño completo' },
      { image: `${T}cochabamba-2137_living.webp`, label: 'Living comedor' },
      { image: `${T}cochabamba-2137_cocina.webp`, label: 'Cocina equipada' },
      { image: `${T}cochabamba-2137_dormitorio.webp`, label: 'Dormitorio con placard' },
      { image: `${T}cochabamba-2137_terraza.webp`, label: 'Terraza con parrilla' },
      { image: `${T}cochabamba-2137_calidad.webp`, label: 'Calidad constructiva' },
    ],
    specs: '11 pisos con terraza verde y parrilla',
    units: 'Unidades de 2 y 3 ambientes',
    sqm: 'De 45 a 87.65 m²',
    price: 'USD 72.000 – 141.000',
    features: ['Balcones con piso deck y parrilla exclusiva', 'Baño y cocina con muebles completos', 'Amplio living – comedor', 'Dormitorios con frente de placard con 2 puertas de piso a techo'],
    construction: [
      { title: 'Paredes', items: ['Mampostería divisoria en ladrillo cerámico hueco', 'Exteriores con doble muro de ladrillo hueco y hormigón armado', 'Terminaciones exteriores con pintura plástica tipo tarquini', 'Interiores con terminación en yeso', 'Baño con cerámica del piso al techo'] },
      { title: 'Pisos y Cielorrasos', items: ['Cielorrasos en yeso armado o aplicado', 'Pisos porcelanato de primera calidad', 'Dormitorios con porcelanato símil madera'] },
      { title: 'Aberturas', items: ['Ventanas de aluminio', 'Puertas placa en interiores'] },
      { title: 'Detalles', items: ['Termo de agua caliente y cocina eléctricos', 'Instalación para aire acondicionado en estar y dormitorio', 'Portero eléctrico con cámara visor'] },
    ],
    sustainability: ['Paneles solares para espacios comunes', 'Sistema de riego con captación de agua de lluvia', 'Cestos de reciclaje', 'Doble muro de ladrillo con cámara de aire', 'Aberturas de doble vidrio (DVH)'],
    nearby: ['Club Social Central Argentino', 'Sanatorio Modelo de Caseros', 'Plaza San Martín', 'Universidad Nacional de San Martín', 'Estación de ferrocarril línea Mitre'],
    brochure: 'https://grupodinal.com/wp-content/uploads/2024/12/Brochure-Cochabamba-2137-.pdf',
    video: 'https://youtu.be/dh-oeEyGm2s',
  },
];

const Emprendimientos = () => {
  const containerRef = useRef(null);
  const [devs, setDevs] = useState([]);
  const [loading, setLoading] = useState(true);
  const allDevs = useMemo(() => [...devs, ...STATIC_TERMINADOS], [devs]);
  const { filtered, filterProps } = useDevelopmentFilters(allDevs);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useLayoutEffect(() => {
    let ctx = gsap.context(() => {
      // Hero elements animate instantly
      gsap.from(".emp-hero", {
        y: 40,
        opacity: 0,
        duration: 1,
        stagger: 0.1,
        ease: "power3.out"
      });

      // Other elements animate on scroll
      gsap.utils.toArray(".emp-scroll").forEach(el => {
        gsap.from(el, {
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
          },
          y: 40,
          opacity: 0,
          duration: 0.8,
          ease: "power3.out"
        });
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    fetchWithCache(
      '/data/developments.json',
      `https://tokkobroker.com/api/v1/development/?key=${import.meta.env.VITE_TOKKO_API_KEY}&lang=es_ar&format=json&limit=100`
    ).then(all => setDevs(all))
     .catch(err => console.error('Developments fetch error:', err))
     .finally(() => setLoading(false));
  }, []);

  return (
    <div ref={containerRef} className="bg-[#F9FAFB] pt-32 pb-24 min-h-screen">
      
      {/* 1. Hero */}
      <section className="px-6 lg:px-12 mb-24">
        <div className="max-w-7xl mx-auto rounded-[2rem] overflow-hidden relative h-[60vh] flex items-center justify-center shadow-2xl">
           <img src={devs.length > 0 && devs[0]?.photos?.length > 0 ? devs[0].photos[0].image : "/images/Size%20Optimized/_MG_4682.jpg"} alt="Emprendimientos" className="absolute inset-0 w-full h-full object-cover scale-105 transition-all duration-1000" />
           <div className="absolute inset-0 bg-primary/70"></div>
           <div className="relative z-10 text-center px-4">
              <span className="emp-hero font-data tracking-widest text-xs text-white/70 mb-4 block">// DESARROLLOS E INVERSIONES</span>
              <h1 className="emp-hero font-drama font-black text-4xl md:text-8xl text-white leading-none mb-4">Desarrollando</h1>
              <p className="emp-hero font-heading font-normal italic text-2xl md:text-3xl text-white/80">Lo Nuevo de San Martín</p>
           </div>
        </div>
      </section>

      {/* 2. Categories */}
      <section className="px-6 lg:px-12 mb-32 max-w-7xl mx-auto">
        <h2 className="emp-scroll font-heading font-bold text-3xl text-primary mb-12 text-center">Modalidades de Inversión</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {[
             { title: "En Pozo", desc: "Máxima rentabilidad al entrar en la etapa inicial del proyecto.", badge: "Mayor ROI" },
             { title: "En Construcción", desc: "Avance comprobable con planes de financiación flexibles y en cuotas.", badge: "Financiado" },
             { title: "A Estrenar", desc: "Unidades terminadas con posesión inmediata, listas para habitar o alquilar.", badge: "Inmediato" },
           ].map((cat, i) => (
             <div key={i} className="emp-scroll bg-white p-6 rounded-2xl border border-primary/10 hover:border-accent hover:-translate-y-1 transition-all shadow-sm">
                <span className="bg-primary/5 text-primary text-xs font-bold px-3 py-1 rounded-full font-heading mb-4 inline-block">{cat.badge}</span>
                <h3 className="font-heading font-bold text-xl text-primary mb-3">{cat.title}</h3>
                <p className="font-heading text-dark/70 text-sm leading-relaxed">{cat.desc}</p>
             </div>
           ))}
        </div>
      </section>

      {/* 3. Tokko Grid */}
      <section className="px-6 lg:px-12 mb-32 max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-12 border-b border-primary/10 pb-6">
           <h2 className="emp-scroll font-drama text-4xl text-primary">Catálogo de Proyectos</h2>
        </div>

        {!loading && <DevelopmentFilters {...filterProps} />}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading ? (
             Array(3).fill(0).map((_,i) => (
               <div key={i} className="animate-pulse bg-white p-4 rounded-[1rem] h-[450px] border border-primary/10">
                 <div className="bg-dark/10 w-full h-[250px] rounded-lg"></div>
                 <div className="mt-4 bg-dark/10 h-6 w-3/4 rounded"></div>
                 <div className="mt-2 bg-dark/10 h-4 w-1/2 rounded"></div>
               </div>
             ))
          ) : filterProps.active ? (
            filtered.length > 0 ? (
              filtered.map(dev => (
                <DevelopmentCard key={dev.id} dev={dev} className="emp-scroll"
                  linkTo={dev._isStatic ? `/emprendimientos/terminado/${dev.id}` : undefined} />
              ))
            ) : (
              <div className="col-span-full py-20 text-center flex flex-col items-center">
                 <Search size={48} className="text-primary/20 mb-4" />
                 <p className="font-heading text-xl text-dark/50">No encontramos proyectos con esos filtros.</p>
                 <button type="button" onClick={filterProps.reset} className="font-heading text-accent mt-2 hover:underline">Limpiar filtros</button>
              </div>
            )
          ) : (
            devs.length > 0 ? (
              devs.map(dev => (
                <DevelopmentCard key={dev.id} dev={dev} className="emp-scroll" />
              ))
            ) : (
              <div className="col-span-full py-20 text-center flex flex-col items-center">
                 <Building size={48} className="text-primary/20 mb-4" />
                 <p className="font-heading text-xl text-dark/50">Actualmente no hay emprendimientos disponibles.</p>
                 <p className="font-heading text-accent mt-2">Consultá con nuestros asesores.</p>
              </div>
            )
          )}
        </div>
      </section>

      {/* 4. Terminados — only when no filter active */}
      {!filterProps.active && (
      <section className="px-6 lg:px-12 mb-32 max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-12 border-b border-primary/10 pb-6">
          <div>
            <h2 className="emp-scroll font-drama text-4xl text-primary">Proyectos Terminados</h2>
            <p className="emp-scroll font-heading text-dark/50 text-sm mt-2">Edificios entregados por Dinal en San Martín</p>
          </div>
          <span className="emp-scroll bg-primary/5 text-primary font-heading font-bold text-xs px-3 py-1.5 rounded-full border border-primary/10">Entregados</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {STATIC_TERMINADOS.map(dev => (
            <DevelopmentCard key={dev.id} dev={dev} className="emp-scroll" linkTo={`/emprendimientos/terminado/${dev.id}`} />
          ))}
        </div>
      </section>
      )}

      {/* 5. Trust Block & CTA */}
      <section className="px-6 lg:px-12">
        <div className="max-w-7xl mx-auto bg-primary rounded-[2rem] p-10 md:p-16 text-center shadow-2xl relative overflow-hidden">
           <div className="relative z-10">
             <h2 className="emp-scroll font-drama text-4xl md:text-5xl text-white mb-6">Respaldamos tu inversión.</h2>
             <p className="emp-scroll font-heading text-white/70 max-w-2xl mx-auto mb-10 text-lg">
               Conocé el mercado en detalle, analizá planos y estructurá pagos junto a un equipo con experiencia real en desarrollo inmobiliario.
             </p>
             <Link to="/contacto" className="emp-scroll inline-block bg-transparent border-2 border-accent text-accent font-heading font-bold px-8 py-4 rounded-xl hover:bg-accent hover:text-primary transition-colors transform hover:scale-105 duration-300 shadow-xl">
               Agendar Asesoramiento
             </Link>
           </div>
        </div>
      </section>

    </div>
  );
};

// ----------------------------------------------------
const TerminadoDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const dev = STATIC_TERMINADOS.find(d => d.id === slug);
  const [activePhoto, setActivePhoto] = useState(0);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
  const [submitStatus, setSubmitStatus] = useState('idle');

  useEffect(() => { window.scrollTo(0, 0); }, []);

  if (!dev) return (
    <div className="min-h-screen bg-[#F9FAFB] pt-32 flex items-center justify-center flex-col gap-4">
      <Building size={64} className="text-primary/20" />
      <h1 className="font-heading font-bold text-2xl text-primary">Proyecto no encontrado</h1>
      <button onClick={() => navigate('/emprendimientos')} className="font-heading text-accent underline">Ver todos los emprendimientos</button>
    </div>
  );

  const handleField = e => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));
  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitStatus('sending');
    try {
      const res = await fetch(`https://tokkobroker.com/api/v1/property/contact/?key=${import.meta.env.VITE_TOKKO_API_KEY}&format=json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formData.name, email: formData.email, phone: formData.phone, message: formData.message || `Consulta sobre nuevos proyectos (referencia: ${dev.name})`, tags: ['Web', 'Terminado'] }),
      });
      setSubmitStatus(res.ok ? 'ok' : 'error');
    } catch { setSubmitStatus('error'); }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] pt-28 pb-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">

        <button onClick={() => navigate('/emprendimientos')} className="flex items-center gap-2 text-dark/50 hover:text-primary font-heading text-sm mb-8 transition-colors group">
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Volver a emprendimientos
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* ── MAIN ── */}
          <div className="lg:col-span-2 flex flex-col gap-8">

            {/* Gallery */}
            <div>
              <div className="relative rounded-2xl overflow-hidden bg-primary/10 h-[420px] md:h-[500px]">
                <img src={dev.photos[activePhoto]?.image} alt={dev.name} className="w-full h-full object-cover transition-opacity duration-300" />
                {dev.photos.length > 1 && (
                  <>
                    <button onClick={() => setActivePhoto(i => (i - 1 + dev.photos.length) % dev.photos.length)} className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors"><ChevronLeft size={22} /></button>
                    <button onClick={() => setActivePhoto(i => (i + 1) % dev.photos.length)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors"><ChevronRight size={22} /></button>
                    <span className="absolute bottom-3 right-3 bg-black/50 text-white text-xs font-data px-3 py-1 rounded-full">{activePhoto + 1} / {dev.photos.length}</span>
                  </>
                )}
              </div>
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {dev.photos.map((ph, i) => (
                  <button key={i} onClick={() => setActivePhoto(i)} className={`shrink-0 h-16 w-24 rounded-lg overflow-hidden border-2 transition-all ${i === activePhoto ? 'border-accent' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                    <img src={ph.image} alt={ph.label} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Header */}
            <div className="bg-white rounded-2xl p-8 border border-primary/10">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="bg-primary text-white font-heading font-bold text-xs px-3 py-1 rounded-full uppercase tracking-wider">Terminado</span>
                <span className="bg-primary/5 text-primary font-heading font-bold text-xs px-3 py-1 rounded-full">Departamentos</span>
              </div>
              <h1 className="font-heading font-black text-2xl md:text-3xl text-primary mb-3 leading-snug">{dev.name}</h1>
              <p className="font-heading text-dark/60 flex items-center gap-1.5 text-sm"><MapPin size={15} className="text-accent shrink-0" />{dev.address}</p>
            </div>

            {/* Specs */}
            <div className="bg-white rounded-2xl p-8 border border-primary/10">
              <h2 className="font-heading font-bold text-lg text-primary mb-6 pb-3 border-b border-primary/10">Características</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                {[
                  { label: 'Edificio', value: dev.specs },
                  { label: 'Unidades', value: dev.units },
                  { label: 'Superficie', value: dev.sqm },
                  { label: 'Precio', value: dev.price },
                ].map(s => (
                  <div key={s.label}>
                    <p className="font-data text-xs text-dark/40 tracking-widest uppercase mb-0.5">{s.label}</p>
                    <p className="font-heading font-semibold text-primary text-sm">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Features */}
            <div className="bg-white rounded-2xl p-8 border border-primary/10">
              <h2 className="font-heading font-bold text-lg text-primary mb-6 pb-3 border-b border-primary/10">Nuestras unidades cuentan con</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dev.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-3 font-heading text-dark/80 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-2" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Construction specs */}
            <div className="bg-white rounded-2xl p-8 border border-primary/10">
              <h2 className="font-heading font-bold text-lg text-primary mb-6 pb-3 border-b border-primary/10">Especificaciones constructivas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {dev.construction.map(sec => (
                  <div key={sec.title}>
                    <h3 className="font-heading font-bold text-primary text-sm mb-3">{sec.title}</h3>
                    <ul className="space-y-1.5">
                      {sec.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 font-heading text-dark/70 text-sm">
                          <span className="w-1 h-1 rounded-full bg-primary/30 shrink-0 mt-2" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Sustainability */}
            <div className="bg-primary rounded-2xl p-8">
              <h2 className="font-heading font-bold text-lg text-white mb-2">Máximo confort, mínimo consumo</h2>
              <p className="font-heading text-white/50 text-sm mb-6">Tecnologías sustentables incorporadas al edificio</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dev.sustainability.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    <span className="font-heading text-white/90 text-sm">{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Nearby */}
            <div className="bg-white rounded-2xl p-8 border border-primary/10">
              <h2 className="font-heading font-bold text-lg text-primary mb-6 pb-3 border-b border-primary/10">Puntos de interés cercanos</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dev.nearby.map((n, i) => (
                  <li key={i} className="flex items-center gap-3 font-heading text-dark/70 text-sm">
                    <MapPin size={14} className="text-accent shrink-0" />
                    {n}
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* ── SIDEBAR ── */}
          <div className="flex flex-col gap-6">

            {/* Contact form */}
            <div className="bg-white rounded-2xl p-6 border border-primary/10 shadow-sm sticky top-28">
              <div className="bg-accent/15 border border-accent/30 rounded-xl px-4 py-3 mb-5">
                <p className="font-heading font-bold text-primary text-sm leading-snug">Todas las unidades de este proyecto fueron vendidas.</p>
                <p className="font-heading text-dark/60 text-sm mt-1">Consultanos para enterarte de nuestros nuevos proyectos.</p>
              </div>
              <h3 className="font-heading font-bold text-primary text-lg mb-1">¿Querés conocer otros proyectos?</h3>
              <p className="font-heading text-dark/50 text-sm mb-6">Dejanos tus datos y te contamos las novedades.</p>
              {submitStatus === 'ok' ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-3"><Check size={24} className="text-primary" /></div>
                  <p className="font-heading font-bold text-primary">¡Mensaje enviado!</p>
                  <p className="font-heading text-dark/50 text-sm mt-1">Te contactamos a la brevedad.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {[
                    { name: 'name', label: 'Nombre', type: 'text', required: true },
                    { name: 'email', label: 'Email', type: 'email', required: true },
                    { name: 'phone', label: 'Teléfono', type: 'tel', required: false },
                  ].map(f => (
                    <div key={f.name}>
                      <label className="font-data text-xs text-dark/40 tracking-widest uppercase mb-1 block">{f.label}</label>
                      <input type={f.type} name={f.name} required={f.required} value={formData[f.name]} onChange={handleField}
                        className="w-full border border-primary/15 rounded-xl px-4 py-3 font-heading text-sm focus:outline-none focus:border-accent transition-colors" />
                    </div>
                  ))}
                  <div>
                    <label className="font-data text-xs text-dark/40 tracking-widest uppercase mb-1 block">Mensaje</label>
                    <textarea name="message" rows={3} value={formData.message} onChange={handleField} placeholder="¿Sobre qué tipo de proyecto querés saber más?"
                      className="w-full border border-primary/15 rounded-xl px-4 py-3 font-heading text-sm focus:outline-none focus:border-accent transition-colors resize-none" />
                  </div>
                  {submitStatus === 'error' && <p className="font-heading text-red-500 text-sm">Hubo un error. Intentá de nuevo.</p>}
                  <button type="submit" disabled={submitStatus === 'sending'}
                    className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-heading font-bold px-6 py-3 rounded-xl transition-colors">
                    {submitStatus === 'sending' ? 'Enviando…' : 'Enviar consulta'}
                  </button>
                </form>
              )}

              {/* WhatsApp */}
              <div className="mt-4 pt-4 border-t border-primary/10 flex flex-col gap-2">
                <a href="https://wa.me/5491177170405" target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 border border-primary/15 hover:border-accent text-primary font-heading font-bold text-sm py-3 rounded-xl transition-colors">
                  WhatsApp Villa Ballester
                </a>
                <a href="https://wa.me/5491177176007" target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 border border-primary/15 hover:border-accent text-primary font-heading font-bold text-sm py-3 rounded-xl transition-colors">
                  WhatsApp San Martín
                </a>
              </div>
            </div>

            {/* Brochure + Video */}
            <div className="bg-white rounded-2xl p-6 border border-primary/10 shadow-sm flex flex-col gap-3">
              <h3 className="font-heading font-bold text-primary text-sm mb-1">Recursos del proyecto</h3>
              {dev.brochure && (
                <a href={dev.brochure} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-primary/5 hover:bg-primary/10 text-primary font-heading font-bold text-sm px-4 py-3 rounded-xl transition-colors">
                  <FileText size={16} className="text-accent shrink-0" />
                  Descargar brochure (PDF)
                </a>
              )}
              {dev.video && (
                <a href={dev.video} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-primary/5 hover:bg-primary/10 text-primary font-heading font-bold text-sm px-4 py-3 rounded-xl transition-colors">
                  <Play size={16} className="text-accent shrink-0" />
                  Ver video del proyecto
                </a>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

// Shared property filter bar (used by Venta + Alquiler)
// ----------------------------------------------------
const ROOM_OPTIONS = [1, 2, 3, 4];
const BATH_OPTIONS = [1, 2, 3];

// Derives the available filter options from the listing set and returns the
// filtered results plus everything <PropertyFilters/> needs to render.
function usePropertyFilters(properties) {
  const [type, setType] = useState('');
  const [location, setLocation] = useState('');
  const [rooms, setRooms] = useState(0);
  const [baths, setBaths] = useState(0);
  const [query, setQuery] = useState('');

  const types = useMemo(
    () => [...new Set(properties.map(p => p.type?.name).filter(Boolean))].sort(),
    [properties]
  );
  const locations = useMemo(
    () => [...new Set(properties.map(p => p.location?.name).filter(Boolean))].sort(),
    [properties]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return properties.filter(p => {
      if (type && p.type?.name !== type) return false;
      if (location && p.location?.name !== location) return false;
      if (rooms && (p.room_amount || 0) < rooms) return false;
      if (baths && (p.bathroom_amount || 0) < baths) return false;
      if (q) {
        const hay = `${p.publication_title || ''} ${p.location?.name || ''} ${p.address || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [properties, type, location, rooms, baths, query]);

  const reset = () => { setType(''); setLocation(''); setRooms(0); setBaths(0); setQuery(''); };
  const active = Boolean(type || location || rooms || baths || query);

  return {
    filtered,
    filterProps: {
      type, setType, location, setLocation, rooms, setRooms, baths, setBaths,
      query, setQuery, types, locations, reset, active, count: filtered.length,
    },
  };
}

const PropertyFilters = ({
  prefix = 'prop', type, setType, location, setLocation, rooms, setRooms,
  baths, setBaths, query, setQuery, types, locations, reset, active, count,
}) => {
  const selectCls = "w-full px-4 py-3 rounded-xl border border-primary/15 font-heading text-sm text-primary bg-white focus:outline-none focus:border-accent transition-colors";
  const pill = (selected) => `px-3 py-1.5 rounded-full font-heading text-sm border transition-colors ${selected ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-primary/15 hover:border-accent'}`;
  const toggle = (current, value, setter) => setter(current === value ? 0 : value);

  return (
    <div className={`${prefix}-scroll bg-white rounded-2xl border border-primary/10 shadow-sm p-5 md:p-6 mb-12`}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por título, zona o dirección…"
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-primary/15 font-heading text-sm text-primary focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <select value={type} onChange={e => setType(e.target.value)} className={selectCls} aria-label="Tipo de propiedad">
          <option value="">Todos los tipos</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={location} onChange={e => setLocation(e.target.value)} className={selectCls} aria-label="Zona">
          <option value="">Todas las zonas</option>
          {locations.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 mt-5">
        <div className="flex items-center gap-2">
          <span className="font-data text-xs uppercase tracking-widest text-primary/40 mr-1">Ambientes</span>
          {ROOM_OPTIONS.map(n => (
            <button key={n} type="button" onClick={() => toggle(rooms, n, setRooms)} className={pill(rooms === n)}>{n}+</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-data text-xs uppercase tracking-widest text-primary/40 mr-1">Baños</span>
          {BATH_OPTIONS.map(n => (
            <button key={n} type="button" onClick={() => toggle(baths, n, setBaths)} className={pill(baths === n)}>{n}+</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4">
          <span className="font-heading text-sm text-dark/50">{count} {count === 1 ? 'resultado' : 'resultados'}</span>
          {active && (
            <button type="button" onClick={reset} className="font-heading text-sm text-primary hover:text-accent inline-flex items-center gap-1 transition-colors">
              <X size={14} /> Limpiar filtros
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------
// Development (emprendimientos) filter bar
// Developments are all "Edificio" type, so they filter by construction
// stage + zone + text rather than rooms/baths.
// ----------------------------------------------------
function useDevelopmentFilters(devs) {
  const [stage, setStage] = useState('');
  const [query, setQuery] = useState('');

  const stages = useMemo(
    () => [...new Set(devs.map(d => constructionLabel(d.construction_status)).filter(Boolean))].sort(),
    [devs]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return devs.filter(d => {
      if (stage && constructionLabel(d.construction_status) !== stage) return false;
      if (q) {
        const hay = `${d.name || ''} ${d.publication_title || ''} ${d.location?.name || ''} ${d.address || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [devs, stage, query]);

  const reset = () => { setStage(''); setQuery(''); };
  const active = Boolean(stage || query);

  return {
    filtered,
    filterProps: { stage, setStage, query, setQuery, stages, reset, active, count: filtered.length },
  };
}

const DevelopmentFilters = ({
  stage, setStage, query, setQuery, stages, reset, active, count,
}) => {
  const pill = (selected) => `px-3 py-1.5 rounded-full font-heading text-sm border transition-colors ${selected ? 'bg-primary text-white border-primary' : 'bg-white text-primary border-primary/15 hover:border-accent'}`;

  return (
    <div className="emp-scroll bg-white rounded-2xl border border-primary/10 shadow-sm p-5 md:p-6 mb-12">
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/40" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar por nombre o dirección…"
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-primary/15 font-heading text-sm text-primary focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 mt-5">
        <div className="flex items-center gap-2">
          <span className="font-data text-xs uppercase tracking-widest text-primary/40 mr-1">Estado de obra</span>
          {stages.map(s => (
            <button key={s} type="button" onClick={() => setStage(stage === s ? '' : s)} className={pill(stage === s)}>{s}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4">
          <span className="font-heading text-sm text-dark/50">{count} {count === 1 ? 'proyecto' : 'proyectos'}</span>
          {active && (
            <button type="button" onClick={reset} className="font-heading text-sm text-primary hover:text-accent inline-flex items-center gap-1 transition-colors">
              <X size={14} /> Limpiar filtros
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------
// J. ALQUILER PAGE
// ----------------------------------------------------
const Alquiler = () => {
  const containerRef = useRef(null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const { filtered, filterProps } = usePropertyFilters(properties);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useLayoutEffect(() => {
    let ctx = gsap.context(() => {
      gsap.from(".alq-hero", { y: 40, opacity: 0, duration: 1, stagger: 0.1, ease: "power3.out" });
      gsap.utils.toArray(".alq-scroll").forEach(el => {
        gsap.from(el, { scrollTrigger: { trigger: el, start: "top 85%" }, y: 40, opacity: 0, duration: 0.8, ease: "power3.out" });
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    fetchWithCache(
      '/data/properties.json',
      `https://tokkobroker.com/api/v1/property/?key=${import.meta.env.VITE_TOKKO_API_KEY}&lang=es_ar&format=json&limit=200`
    ).then(all => {
        const rentals = all.filter(p => p.operations?.some(op => op.operation_type === 'Alquiler'));
        setProperties(rentals);
      })
     .catch(err => console.error(err))
     .finally(() => setLoading(false));
  }, []);

  return (
    <div ref={containerRef} className="bg-[#F9FAFB] pt-32 pb-24 min-h-screen">
      <section className="px-6 lg:px-12 mb-24">
        <div className="max-w-7xl mx-auto rounded-[2rem] overflow-hidden relative h-[60vh] flex items-center justify-center shadow-2xl">
           <img src={properties.length > 0 && properties[0]?.photos?.length > 0 ? properties[0].photos[0].image : "/images/Size%20Optimized/_MG_1108.jpg"} alt="Alquileres" className="absolute inset-0 w-full h-full object-cover scale-105 transition-all duration-1000" />
           <div className="absolute inset-0 bg-primary/70"></div>
           <div className="relative z-10 text-center px-4">
              <span className="alq-hero font-data tracking-widest text-xs text-white/70 mb-4 block">// ALQUILERES</span>
              <h1 className="alq-hero font-drama font-black text-5xl md:text-7xl text-white mb-6">Tu próximo lugar, <br/><span className="font-heading font-black italic text-white tracking-tight">sin complicaciones.</span></h1>
              <p className="alq-hero font-heading text-lg text-white/80 max-w-xl mx-auto">Ofrecemos un catálogo selecto de alquileres residenciales y comerciales en la zona, garantizando un trato transparente.</p>
           </div>
        </div>
      </section>

      <section className="px-6 lg:px-12 mb-32 max-w-7xl mx-auto">
        <h2 className="alq-scroll font-heading font-bold text-3xl text-primary mb-12 text-center">Nuestras Opciones</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {[ 
             { title: "Residencial", desc: "Casas y departamentos en excelentes condiciones para vos y tu familia.", badge: "Vivienda" },
             { title: "Comercial", desc: "Locales y oficinas estratégicamente ubicados para potenciar tu negocio.", badge: "Negocios" },
             { title: "Garantías", desc: "Te brindamos asesoramiento permanente para que el proceso sea 100% seguro.", badge: "Legal" }
           ].map((cat, i) => (
             <div key={i} className="alq-scroll bg-white p-6 rounded-2xl border border-primary/10 hover:border-accent hover:-translate-y-1 transition-all shadow-sm">
                <span className="bg-primary/5 text-primary text-xs font-bold px-3 py-1 rounded-full font-heading mb-4 inline-block">{cat.badge}</span>
                <h3 className="font-heading font-bold text-xl text-primary mb-3">{cat.title}</h3>
                <p className="font-heading text-dark/70 text-sm leading-relaxed">{cat.desc}</p>
             </div>
           ))}
        </div>
      </section>

      {!loading && properties.some(p => p.is_starred_on_web) && (
        <section className="px-6 lg:px-12 mb-32 max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-10 border-b border-primary/10 pb-6">
             <h2 className="alq-scroll font-drama text-4xl text-primary">Destacadas</h2>
          </div>
          <FeaturedSlider items={properties.filter(p => p.is_starred_on_web)} renderItem={p => <PropertyCard prop={p} opType="Alquiler" />} />
        </section>
      )}

      <section className="px-6 lg:px-12 mb-32 max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-12 border-b border-primary/10 pb-6">
           <h2 className="alq-scroll font-drama text-4xl text-primary">Propiedades en Alquiler</h2>
        </div>
        {!loading && properties.length > 0 && <PropertyFilters prefix="alq" {...filterProps} />}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading ? (
             Array(3).fill(0).map((_,i) => (
               <div key={i} className="animate-pulse bg-white p-4 rounded-[1rem] h-[450px] border border-primary/10">
                 <div className="bg-dark/10 w-full h-[250px] rounded-lg"></div>
                 <div className="mt-4 bg-dark/10 h-6 w-3/4 rounded"></div>
               </div>
             ))
          ) : filtered.length > 0 ? (
             filtered.map(prop => (
               <PropertyCard key={prop.id} prop={prop} opType="Alquiler" className="alq-scroll" />
             ))
          ) : filterProps.active ? (
            <div className="col-span-full py-20 text-center flex flex-col items-center">
               <Search size={48} className="text-primary/20 mb-4" />
               <p className="font-heading text-xl text-dark/50">No encontramos alquileres con esos filtros.</p>
               <button type="button" onClick={filterProps.reset} className="font-heading text-accent mt-2 hover:underline">Limpiar filtros</button>
            </div>
          ) : (
            <div className="col-span-full py-20 text-center flex flex-col items-center">
               <Building size={48} className="text-primary/20 mb-4" />
               <p className="font-heading text-xl text-dark/50">Actualmente no hay alquileres disponibles en el catálogo.</p>
               <p className="font-heading text-accent mt-2">Contactate para propiedades off-market.</p>
            </div>
          )}
        </div>
      </section>

      <section className="px-6 lg:px-12">
        <div className="max-w-7xl mx-auto bg-primary rounded-[2rem] p-10 md:p-16 text-center shadow-2xl relative overflow-hidden">
           <div className="relative z-10">
             <h2 className="alq-scroll font-drama text-4xl md:text-5xl text-white mb-6">Tu próximo hogar te espera.</h2>
             <Link to="/contacto" className="alq-scroll inline-block bg-transparent border-2 border-accent text-accent font-heading font-bold px-8 py-4 rounded-xl hover:bg-accent hover:text-primary transition-colors transform hover:scale-105 duration-300 shadow-xl">
               Contactar Asesor
             </Link>
           </div>
        </div>
      </section>
    </div>
  );
};

// ----------------------------------------------------
// K. VENTA PAGE
// ----------------------------------------------------
const Ventas = () => {
  const containerRef = useRef(null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [devHeroImg, setDevHeroImg] = useState('/images/Size%20Optimized/_MG_4682.jpg');
  const { filtered, filterProps } = usePropertyFilters(properties);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useLayoutEffect(() => {
    let ctx = gsap.context(() => {
      gsap.from(".vnt-hero", { y: 40, opacity: 0, duration: 1, stagger: 0.1, ease: "power3.out" });
      gsap.utils.toArray(".vnt-scroll").forEach(el => {
        gsap.from(el, { scrollTrigger: { trigger: el, start: "top 85%" }, y: 40, opacity: 0, duration: 0.8, ease: "power3.out" });
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    fetchWithCache(
      '/data/developments.json',
      `https://tokkobroker.com/api/v1/development/?key=${import.meta.env.VITE_TOKKO_API_KEY}&lang=es_ar&format=json&limit=100`
    ).then(devs => {
      const img = devs?.find(d => d.photos?.length > 0)?.photos[0]?.image;
      if (img) setDevHeroImg(img);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetchWithCache(
      '/data/properties.json',
      `https://tokkobroker.com/api/v1/property/?key=${import.meta.env.VITE_TOKKO_API_KEY}&lang=es_ar&format=json&limit=200`
    ).then(all => {
        const sales = all.filter(p => p.operations?.some(op => op.operation_type === 'Venta'));
        setProperties(sales);
      })
     .catch(err => console.error(err))
     .finally(() => setLoading(false));
  }, []);

  return (
    <div ref={containerRef} className="bg-[#F9FAFB] pt-32 pb-24 min-h-screen">
      <section className="px-6 lg:px-12 mb-24">
        <div className="max-w-7xl mx-auto rounded-[2rem] overflow-hidden relative h-[60vh] flex items-center justify-center shadow-2xl">
           <img src={devHeroImg} alt="Ventas" className="absolute inset-0 w-full h-full object-cover scale-105 transition-all duration-1000" />
           <div className="absolute inset-0 bg-primary/70"></div>
           <div className="relative z-10 text-center px-4">
              <span className="vnt-hero font-data tracking-widest text-xs text-white/70 mb-4 block">// COMPRA Y VENTA</span>
              <h1 className="vnt-hero font-drama font-black text-5xl md:text-7xl text-white mb-6">El hogar ideal <br/><span className="font-heading font-black italic text-white tracking-tight">es posible.</span></h1>
              <p className="vnt-hero font-heading text-lg text-white/80 max-w-xl mx-auto">Te ayudamos a encontrar, negociar y adquirir la propiedad de tus sueños con total transparencia y seguridad.</p>
           </div>
        </div>
      </section>

      <section className="px-6 lg:px-12 mb-32 max-w-7xl mx-auto">
        <h2 className="vnt-scroll font-heading font-bold text-3xl text-primary mb-12 text-center">Nuestras Soluciones de Venta</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {[
             { title: "Casas", desc: "Espacios amplios y jardines pensados para tu familia.", badge: "Familia" },
             { title: "Departamentos", desc: "Ubicaciones céntricas con todas las comodidades y seguridad.", badge: "Urbano" },
             { title: "Comercial", desc: "Oportunidades únicas de inversión para locales y empresas.", badge: "Inversión" }
           ].map((cat, i) => (
             <div key={i} className="vnt-scroll bg-white p-6 rounded-2xl border border-primary/10 hover:border-accent hover:-translate-y-1 transition-all shadow-sm">
                <span className="bg-primary/5 text-primary text-xs font-bold px-3 py-1 rounded-full font-heading mb-4 inline-block">{cat.badge}</span>
                <h3 className="font-heading font-bold text-xl text-primary mb-3">{cat.title}</h3>
                <p className="font-heading text-dark/70 text-sm leading-relaxed">{cat.desc}</p>
             </div>
           ))}
        </div>
      </section>

      {!loading && properties.some(p => p.is_starred_on_web) && (
        <section className="px-6 lg:px-12 mb-32 max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-10 border-b border-primary/10 pb-6">
             <h2 className="vnt-scroll font-drama text-4xl text-primary">Destacadas</h2>
          </div>
          <FeaturedSlider items={properties.filter(p => p.is_starred_on_web)} renderItem={p => <PropertyCard prop={p} opType="Venta" />} />
        </section>
      )}

      <section className="px-6 lg:px-12 mb-32 max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-12 border-b border-primary/10 pb-6">
           <h2 className="vnt-scroll font-drama text-4xl text-primary">Propiedades en Venta</h2>
        </div>
        {!loading && properties.length > 0 && <PropertyFilters prefix="vnt" {...filterProps} />}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading ? (
             Array(3).fill(0).map((_,i) => (
               <div key={i} className="animate-pulse bg-white p-4 rounded-[1rem] h-[450px] border border-primary/10">
                 <div className="bg-dark/10 w-full h-[250px] rounded-lg"></div>
                 <div className="mt-4 bg-dark/10 h-6 w-3/4 rounded"></div>
               </div>
             ))
          ) : filtered.length > 0 ? (
             filtered.map(prop => (
               <PropertyCard key={prop.id} prop={prop} opType="Venta" className="vnt-scroll" />
             ))
          ) : filterProps.active ? (
            <div className="col-span-full py-20 text-center flex flex-col items-center">
               <Search size={48} className="text-primary/20 mb-4" />
               <p className="font-heading text-xl text-dark/50">No encontramos propiedades con esos filtros.</p>
               <button type="button" onClick={filterProps.reset} className="font-heading text-accent mt-2 hover:underline">Limpiar filtros</button>
            </div>
          ) : (
            <div className="col-span-full py-20 text-center flex flex-col items-center">
               <Building size={48} className="text-primary/20 mb-4" />
               <p className="font-heading text-xl text-dark/50">Actualmente no hay propiedades en venta publicadas.</p>
            </div>
          )}
        </div>
      </section>

      <section className="px-6 lg:px-12">
        <div className="max-w-7xl mx-auto bg-primary rounded-[2rem] p-10 md:p-16 text-center shadow-2xl relative overflow-hidden">
           <div className="relative z-10">
             <h2 className="vnt-scroll font-drama text-4xl md:text-5xl text-white mb-6">Empezá tu nueva etapa.</h2>
             <Link to="/contacto" className="vnt-scroll inline-block bg-transparent border-2 border-accent text-accent font-heading font-bold px-8 py-4 rounded-xl hover:bg-accent hover:text-primary transition-colors transform hover:scale-105 duration-300 shadow-xl">
               Contactar Asesor
             </Link>
           </div>
        </div>
      </section>
    </div>
  );
};

// ----------------------------------------------------
// L. SUCURSALES PAGE
// ----------------------------------------------------
const Sucursales = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useLayoutEffect(() => {
    let ctx = gsap.context(() => {
      gsap.from(".suc-hero", { y: 40, opacity: 0, duration: 1, stagger: 0.1, ease: "power3.out" });
      gsap.utils.toArray(".suc-scroll").forEach(el => {
        gsap.from(el, { scrollTrigger: { trigger: el, start: "top 85%" }, y: 40, opacity: 0, duration: 0.8, ease: "power3.out" });
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const branches = [
    {
      id: "ballester",
      name: "Villa Ballester",
      address: "Almirante Brown 3295",
      phone: "+54 9 11 7717-0405",
      whatsapp: "5491177170405",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Almirante+Brown+3295,+Villa+Ballester",
      hours: "Lunes a Viernes: 10 a 13 hs. y 14 a 18 hs.",
      img: sucursalBallester
    },
    {
      id: "sanmartin",
      name: "San Martín",
      address: "Mitre 3404",
      phone: "+54 9 11 7717-6007",
      whatsapp: "5491177176007",
      mapUrl: "https://www.google.com/maps/search/?api=1&query=Mitre+3404,+San+Martin",
      hours: "Lunes a Viernes: 10 a 13 hs. y 14 a 18 hs.",
      img: sucursalSanMartin
    }
  ];

  return (
    <div ref={containerRef} className="bg-[#F9FAFB] pt-32 pb-24 min-h-screen">
      <section className="px-6 lg:px-12 mb-24">
        <div className="max-w-7xl mx-auto rounded-[2rem] overflow-hidden relative h-[60vh] flex items-center justify-center shadow-2xl">
           <img src="/images/Size%20Optimized/_MG_2463.jpg" alt="Nuestras Sucursales" className="absolute inset-0 w-full h-full object-cover scale-105 transition-all duration-1000" />
           <div className="absolute inset-0 bg-primary/70"></div>
           <div className="relative z-10 text-center px-4">
              <span className="suc-hero font-data tracking-widest text-xs text-white/70 mb-4 block">// NUESTRAS OFICINAS</span>
              <h1 className="suc-hero font-drama font-black text-5xl md:text-7xl text-white mb-6">Siempre cerca <br/><span className="font-heading font-black text-white tracking-tight">tuyo.</span></h1>
              <p className="suc-hero font-heading text-lg text-white/80 max-w-xl mx-auto">Te esperamos en nuestras sucursales para brindarte asesoramiento personalizado, tomar un café y proyectar tu próxima inversión.</p>
           </div>
        </div>
      </section>

      <section className="px-6 lg:px-12 mb-32 max-w-7xl mx-auto">
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {branches.map(branch => (
               <div key={branch.id} className="suc-scroll bg-white rounded-[2rem] shadow-xl border border-primary/5 overflow-hidden flex flex-col hover:-translate-y-2 transition-transform duration-500 group">
                  <div className="h-[300px] w-full relative overflow-hidden">
                     <img src={branch.img} alt={`Sucursal ${branch.name}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                     <div className="absolute top-6 left-6 bg-white px-4 py-2 rounded-full shadow-md">
                        <span className="font-heading font-bold text-primary uppercase tracking-wider text-sm">{branch.name}</span>
                     </div>
                  </div>
                  <div className="p-8 flex flex-col flex-grow">
                     <div className="mb-8">
                        <div className="flex items-start gap-4 mb-4">
                           <div className="bg-primary/5 p-3 rounded-full text-accent mt-1"><MapPin size={24} /></div>
                           <div>
                              <p className="font-data text-xs text-dark/40 tracking-widest uppercase mb-1">Dirección</p>
                              <p className="font-heading font-medium text-primary text-lg">{branch.address}</p>
                           </div>
                        </div>
                        <div className="flex items-start gap-4 mb-4">
                           <div className="bg-primary/5 p-3 rounded-full text-accent mt-1"><Clock size={24} /></div>
                           <div>
                              <p className="font-data text-xs text-dark/40 tracking-widest uppercase mb-1">Horarios</p>
                              <p className="font-heading font-medium text-dark/70">{branch.hours}</p>
                           </div>
                        </div>
                        <div className="flex items-start gap-4">
                           <div className="bg-primary/5 p-3 rounded-full text-accent mt-1"><Phone size={24} /></div>
                           <div>
                              <p className="font-data text-xs text-dark/40 tracking-widest uppercase mb-1">Atención Telefónica</p>
                              <a href={`tel:${branch.phone.replace(/\s+/g, '')}`} className="font-heading font-medium text-primary text-lg hover:text-accent transition-colors block">{branch.phone}</a>
                           </div>
                        </div>
                     </div>
                     <div className="mt-auto grid grid-cols-2 gap-4">
                         <a href={branch.mapUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-primary text-white font-heading font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors shadow-lg">
                            Ver Mapa <Compass size={18} />
                         </a>
                         <a href={`https://wa.me/${branch.whatsapp}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-transparent border-2 border-[#25D366] text-[#25D366] font-heading font-bold py-3 rounded-xl hover:bg-[#25D366] hover:text-white transition-all shadow-lg">
                            WhatsApp
                         </a>
                     </div>
                  </div>
               </div>
            ))}
         </div>
      </section>

      <section className="px-6 lg:px-12">
        <div className="max-w-7xl mx-auto bg-primary rounded-[2rem] p-10 md:p-16 text-center shadow-2xl relative overflow-hidden">
           <div className="relative z-10">
             <h2 className="suc-scroll font-drama text-4xl md:text-5xl text-white mb-6">¿Buscás tasar tu propiedad?</h2>
             <p className="suc-scroll font-heading text-white/70 max-w-2xl mx-auto mb-10 text-lg">Acercate a la sucursal más cercana o contactanos online para coordinar una visita con nuestros tasadores profesionales.</p>
             <Link to="/contacto" className="suc-scroll inline-block bg-transparent border-2 border-accent text-accent font-heading font-bold px-8 py-4 rounded-xl hover:bg-accent hover:text-primary transition-colors transform hover:scale-105 duration-300 shadow-xl">
               Solicitar Tasación
             </Link>
           </div>
        </div>
      </section>
    </div>
  );
};

const Home = () => (
  <>
    <Hero />
    <Features />
    <Philosophy />
    <Categories />
    <Oportunidades />
  </>
);

// ----------------------------------------------------
// PROPERTY DETAIL PAGE
// ----------------------------------------------------
const WA_ICON = (
  <svg viewBox="0 0 24 24" width={20} height={20} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const PropertyInquiryForm = ({ propertyId }) => {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | success | error

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch(
        `https://tokkobroker.com/api/v1/property/contact/?key=${import.meta.env.VITE_TOKKO_API_KEY}&format=json`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_ids: [propertyId],
            name: form.name,
            email: form.email,
            phone: form.phone,
            message: form.message || `Consulta sobre propiedad #${propertyId}`,
            tags: ['Web'],
          }),
        }
      );
      if (!res.ok) throw new Error('Error al enviar');
      setStatus('success');
      setForm({ name: '', email: '', phone: '', message: '' });
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="bg-accent/10 border border-accent/30 rounded-xl p-6 text-center">
        <p className="font-heading font-bold text-primary text-sm mb-1">¡Consulta enviada!</p>
        <p className="font-heading text-dark/60 text-xs">Nos comunicaremos a la brevedad.</p>
        <button onClick={() => setStatus('idle')} className="mt-4 font-heading text-xs text-primary/50 hover:text-primary transition-colors underline">
          Enviar otra consulta
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-2">
      <p className="font-heading font-semibold text-sm text-primary">Consultar por esta propiedad</p>
      <input
        name="name" value={form.name} onChange={handleChange} required
        placeholder="Nombre completo"
        className="w-full border border-primary/15 rounded-xl px-4 py-2.5 font-heading text-sm text-primary placeholder-dark/30 focus:outline-none focus:border-accent transition-colors"
      />
      <input
        name="email" type="email" value={form.email} onChange={handleChange} required
        placeholder="Email"
        className="w-full border border-primary/15 rounded-xl px-4 py-2.5 font-heading text-sm text-primary placeholder-dark/30 focus:outline-none focus:border-accent transition-colors"
      />
      <input
        name="phone" value={form.phone} onChange={handleChange}
        placeholder="Teléfono (opcional)"
        className="w-full border border-primary/15 rounded-xl px-4 py-2.5 font-heading text-sm text-primary placeholder-dark/30 focus:outline-none focus:border-accent transition-colors"
      />
      <textarea
        name="message" value={form.message} onChange={handleChange}
        placeholder="Mensaje (opcional)"
        rows={3}
        className="w-full border border-primary/15 rounded-xl px-4 py-2.5 font-heading text-sm text-primary placeholder-dark/30 focus:outline-none focus:border-accent transition-colors resize-none"
      />
      {status === 'error' && (
        <p className="font-heading text-xs text-red-500">Hubo un error. Intentá de nuevo o escribinos por WhatsApp.</p>
      )}
      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-heading font-bold px-6 py-3 rounded-xl transition-colors"
      >
        {status === 'sending' ? 'Enviando…' : 'Solicitar información'}
      </button>
    </form>
  );
};

const PropertyDetail = () => {
  const { id: rawSlug } = useParams();
  const id = rawSlug.split('-')[0];
  const navigate = useNavigate();
  const [prop, setProp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);
  const { setAddress } = useContext(PropertyCtx);

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    setProp(null);

    // 1. Try properties cache
    fetch('/data/properties.json')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        const arr = Array.isArray(data) ? data : (data.objects ?? []);
        const found = arr.find(x => String(x.id) === String(id));
        if (found) { setProp(found); setLoading(false); return; }
        // 2. Try developments cache
        return fetch('/data/developments.json')
          .then(r => r.json())
          .then(data2 => {
            const arr2 = Array.isArray(data2) ? data2 : (data2.objects ?? []);
            const found2 = arr2.find(x => String(x.id) === String(id));
            if (found2) { setProp(found2); setLoading(false); }
            else throw new Error('not in cache');
          });
      })
      .catch(() => {
        // 3. Fallback: try both property AND development API endpoints in parallel
        const key = import.meta.env.VITE_TOKKO_API_KEY;
        Promise.allSettled([
          fetch(`https://tokkobroker.com/api/v1/property/${id}/?key=${key}&lang=es_ar&format=json`).then(r => r.json()),
          fetch(`https://tokkobroker.com/api/v1/development/${id}/?key=${key}&lang=es_ar&format=json`).then(r => r.json()),
        ]).then(([propRes, devRes]) => {
          const propData = propRes.status === 'fulfilled' && propRes.value?.id  ? propRes.value  : null;
          const devData  = devRes.status  === 'fulfilled' && devRes.value?.id   ? devRes.value   : null;
          setProp(propData ?? devData ?? null);
        }).finally(() => setLoading(false));
      });
  }, [id]);

  useEffect(() => {
    if (prop) setAddress(prop.fake_address ?? prop.publication_title ?? prop.name ?? null);
    return () => setAddress(null);
  }, [prop]);


  if (loading) return (
    <div className="min-h-screen bg-[#F9FAFB] pt-32 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-accent rounded-full animate-spin" />
        <p className="font-heading text-dark/50">Cargando propiedad…</p>
      </div>
    </div>
  );

  if (!prop) return (
    <div className="min-h-screen bg-[#F9FAFB] pt-32 flex items-center justify-center flex-col gap-4">
      <Building size={64} className="text-primary/20" />
      <h1 className="font-heading font-bold text-2xl text-primary">Propiedad no encontrada</h1>
      <button onClick={() => navigate(-1)} className="font-heading text-accent underline">Volver</button>
    </div>
  );

  const op    = prop.operations?.[0];
  const price = op?.prices?.[0];
  const photos = prop.photos ?? [];
  const title  = prop.publication_title ?? prop.name ?? '';
  const lat    = prop.geo_lat  ?? prop.location?.lat;
  const lon    = prop.geo_long ?? prop.location?.lon;

  // Group tags by type
  const tagsByType = (prop.tags ?? []).reduce((acc, t) => {
    if (!acc[t.type]) acc[t.type] = [];
    acc[t.type].push(t.name);
    return acc;
  }, {});

  const specs = [
    { label: 'Tipo',            value: prop.property_type?.name },
    { label: 'Ambientes',       value: prop.room_amount },
    { label: 'Dormitorios',     value: prop.suite_amount },
    { label: 'Baños',           value: prop.bathroom_amount },
    { label: 'Cocheras',        value: prop.parking_lot_amount },
    { label: 'Sup. cubierta',   value: prop.roofed_surface   ? `${prop.roofed_surface} m²`   : null },
    { label: 'Sup. descubierta',value: prop.unroofed_surface ? `${prop.unroofed_surface} m²` : null },
    { label: 'Sup. semicubierta',value: prop.semiroofed_surface ? `${prop.semiroofed_surface} m²` : null },
    { label: 'Sup. total',      value: prop.total_surface    ? `${prop.total_surface} m²`    : null },
    { label: 'Estado',          value: prop.property_condition ?? constructionLabel(prop.construction_status) },
    { label: 'Antigüedad',      value: prop.age },
    { label: 'Expensas',        value: prop.expenses ? `ARS ${Number(prop.expenses).toLocaleString('es-AR')}` : null },
  ].filter(s => s.value != null && s.value !== '' && s.value !== 0);

  return (
    <div className="min-h-screen bg-[#F9FAFB] pt-28 pb-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">

        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-dark/50 hover:text-primary font-heading text-sm mb-8 transition-colors group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Volver a resultados
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* ── MAIN COLUMN ─────────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-8">

            {/* Gallery */}
            {photos.length > 0 && (
              <div>
                <div className="relative rounded-2xl overflow-hidden bg-primary/10 h-[420px] md:h-[500px]">
                  <img
                    src={photos[activePhoto]?.image}
                    alt={title}
                    className="w-full h-full object-cover transition-opacity duration-300"
                  />
                  {photos.length > 1 && (
                    <>
                      <button
                        onClick={() => setActivePhoto(i => (i - 1 + photos.length) % photos.length)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors"
                      >
                        <ChevronLeft size={22} />
                      </button>
                      <button
                        onClick={() => setActivePhoto(i => (i + 1) % photos.length)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors"
                      >
                        <ChevronRight size={22} />
                      </button>
                      <span className="absolute bottom-3 right-3 bg-black/50 text-white text-xs font-data px-3 py-1 rounded-full">
                        {activePhoto + 1} / {photos.length}
                      </span>
                    </>
                  )}
                </div>
                {/* Thumbnails */}
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                  {photos.map((ph, i) => (
                    <button
                      key={i}
                      onClick={() => setActivePhoto(i)}
                      className={`shrink-0 h-16 w-24 rounded-lg overflow-hidden border-2 transition-all ${i === activePhoto ? 'border-accent' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    >
                      <img src={ph.thumb ?? ph.image} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Header */}
            <div className="bg-white rounded-2xl p-8 border border-primary/10">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {op?.operation_type && (
                  <span className="bg-primary text-white font-heading font-bold text-xs px-3 py-1 rounded-full uppercase tracking-wider">
                    {op.operation_type}
                  </span>
                )}
                {prop.property_type?.name && (
                  <span className="bg-primary/5 text-primary font-heading font-bold text-xs px-3 py-1 rounded-full">
                    {prop.property_type.name}
                  </span>
                )}
                <span className="ml-auto font-data text-xs text-dark/40 tracking-widest">
                  REF: {prop.reference_code ?? prop.id}
                </span>
              </div>
              <h1 className="font-heading font-black text-2xl md:text-3xl text-primary mb-3 leading-snug">{title}</h1>
              {(prop.address || prop.location?.name) && (
                <p className="font-heading text-dark/60 flex items-center gap-1.5 text-sm">
                  <MapPin size={15} className="text-accent shrink-0" />
                  {prop.address ? `${prop.address}${prop.location?.name ? `, ${prop.location.name}` : ''}` : prop.location?.name}
                </p>
              )}
            </div>

            {/* Specs */}
            {specs.length > 0 && (
              <div className="bg-white rounded-2xl p-8 border border-primary/10">
                <h2 className="font-heading font-bold text-lg text-primary mb-6 pb-3 border-b border-primary/10">Características</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
                  {specs.map(s => (
                    <div key={s.label}>
                      <p className="font-data text-xs text-dark/40 tracking-widest uppercase mb-0.5">{s.label}</p>
                      <p className="font-heading font-semibold text-primary">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {(prop.enhanced_description || prop.rich_description || prop.description) && (
              <div className="bg-white rounded-2xl p-8 border border-primary/10">
                <h2 className="font-heading font-bold text-lg text-primary mb-4 pb-3 border-b border-primary/10">Descripción</h2>
                {prop.enhanced_description || prop.rich_description ? (
                  <div
                    className="font-heading text-dark/70 leading-relaxed text-sm property-description"
                    dangerouslySetInnerHTML={{ __html: prop.enhanced_description || prop.rich_description }}
                  />
                ) : (
                  <p className="font-heading text-dark/70 leading-relaxed whitespace-pre-line text-sm">{prop.description}</p>
                )}
              </div>
            )}

            {/* Amenities */}
            {Object.keys(tagsByType).length > 0 && (
              <div className="bg-white rounded-2xl p-8 border border-primary/10">
                <h2 className="font-heading font-bold text-lg text-primary mb-6 pb-3 border-b border-primary/10">Comodidades</h2>
                <div className="flex flex-col gap-6">
                  {Object.entries(tagsByType).map(([type, names]) => (
                    <div key={type}>
                      <p className="font-data text-xs text-dark/40 tracking-widest uppercase mb-3">
                        {TAG_TYPE_LABELS[type] ?? type}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {names.map(name => (
                          <span key={name} className="inline-flex items-center gap-1.5 bg-primary/5 text-primary font-heading text-sm px-3 py-1.5 rounded-lg border border-primary/10">
                            <span className="text-primary/50 shrink-0">{TAG_ICONS[name] ?? <Check size={14} />}</span>
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Map */}
            {lat && lon && import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
              <div className="bg-white rounded-2xl overflow-hidden border border-primary/10">
                <div className="p-6 pb-0">
                  <h2 className="font-heading font-bold text-lg text-primary mb-4">Ubicación</h2>
                </div>
                <iframe
                  title="Mapa de ubicación"
                  width="100%"
                  height="320"
                  style={{ border: 0, display: 'block' }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&q=${lat},${lon}&zoom=15`}
                />
              </div>
            )}
          </div>

          {/* ── SIDEBAR ─────────────────────────────────── */}
          <div className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">

            {/* Price + CTA */}
            <div className="bg-white rounded-2xl p-8 border border-primary/10 shadow-sm">
              {price && (
                <div className="mb-6 pb-6 border-b border-primary/10">
                  <p className="font-data text-xs text-dark/40 tracking-widest uppercase mb-1">Precio</p>
                  <p className="font-drama font-black text-4xl text-primary leading-none">
                    {price.currency} {Number(price.price).toLocaleString('es-AR')}
                  </p>
                  {prop.expenses && (
                    <p className="font-heading text-xs text-dark/50 mt-2">
                      + Expensas ARS {Number(prop.expenses).toLocaleString('es-AR')}
                    </p>
                  )}
                </div>
              )}

              <p className="font-heading font-semibold text-sm text-primary mb-3">Consultar por WhatsApp</p>
              <div className="flex flex-col gap-2 mb-5">
                <a
                  href={`https://wa.me/5491177170405?text=${encodeURIComponent(`Hola, quería más información sobre esta propiedad: ${window.location.href}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-heading font-semibold text-sm px-4 py-3 rounded-xl transition-colors"
                >
                  {WA_ICON}
                  Villa Ballester
                </a>
                <a
                  href={`https://wa.me/5491177176007?text=${encodeURIComponent(`Hola, quería más información sobre esta propiedad: ${window.location.href}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-heading font-semibold text-sm px-4 py-3 rounded-xl transition-colors"
                >
                  {WA_ICON}
                  San Martín
                </a>
              </div>

              <PropertyInquiryForm propertyId={prop.id} />
            </div>

            {/* Branch offices */}
            <div className="bg-white rounded-2xl p-8 border border-primary/10">
              <h3 className="font-heading font-bold text-sm text-primary mb-5 pb-3 border-b border-primary/10 uppercase tracking-wider">Nuestras Oficinas</h3>
              <div className="flex flex-col gap-5">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/5 p-2 rounded-lg text-accent shrink-0 mt-0.5"><MapPin size={16} /></div>
                  <div>
                    <p className="font-heading font-semibold text-primary text-sm">Villa Ballester</p>
                    <p className="font-heading text-xs text-dark/60">Almirante Brown 3295</p>
                    <a href="tel:+5491177170405" className="font-heading text-xs text-primary/60 hover:text-primary transition-colors">+54 9 11 7717-0405</a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-primary/5 p-2 rounded-lg text-accent shrink-0 mt-0.5"><MapPin size={16} /></div>
                  <div>
                    <p className="font-heading font-semibold text-primary text-sm">San Martín</p>
                    <p className="font-heading text-xs text-dark/60">Mitre 3404</p>
                    <a href="tel:+5491177176007" className="font-heading text-xs text-primary/60 hover:text-primary transition-colors">+54 9 11 7717-6007</a>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

const WA_SVG = <svg viewBox="0 0 24 24" width={18} height={18} fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>;

const WhatsAppButton = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const isOdmPage = location.pathname.startsWith('/obras-de-mar');
  const isPropertyPage = location.pathname.startsWith('/propiedad/') || location.pathname.startsWith('/obras-de-mar/propiedad/');
  const msg = isPropertyPage
    ? `Hola, quería más información sobre esta propiedad: ${window.location.origin}${location.pathname}`
    : 'Hola, quería realizar una consulta.';

  const waUrl = (number) =>
    `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Tooltip */}
      <div className={`flex flex-col gap-2 transition-all duration-300 ${open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
        {isOdmPage ? (
          <a
            href={waUrl('5491176027596')}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-white text-primary font-heading font-semibold text-sm px-4 py-3 rounded-2xl shadow-xl border border-primary/10 hover:border-[#25D366] hover:text-[#25D366] transition-all duration-200 whitespace-nowrap"
          >
            {WA_SVG}
            Mar del Plata
          </a>
        ) : (
          <>
            <a
              href={waUrl('5491177170405')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white text-primary font-heading font-semibold text-sm px-4 py-3 rounded-2xl shadow-xl border border-primary/10 hover:border-[#25D366] hover:text-[#25D366] transition-all duration-200 whitespace-nowrap"
            >
              {WA_SVG}
              Villa Ballester
            </a>
            <a
              href={waUrl('5491177176007')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white text-primary font-heading font-semibold text-sm px-4 py-3 rounded-2xl shadow-xl border border-primary/10 hover:border-[#25D366] hover:text-[#25D366] transition-all duration-200 whitespace-nowrap"
            >
              {WA_SVG}
              San Martín
            </a>
          </>
        )}
      </div>

      {/* Main button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-14 h-14 rounded-full bg-[#25D366] text-white shadow-2xl flex items-center justify-center hover:scale-110 transition-transform duration-300 focus:outline-none"
        aria-label="Contactar por WhatsApp"
      >
        {open ? (
          <X size={24} />
        ) : (
          <svg viewBox="0 0 24 24" width={28} height={28} fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        )}
      </button>
    </div>
  );
};

// ----------------------------------------------------
// SOBRE NOSOTROS
// ----------------------------------------------------
const SobreNosotros = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useLayoutEffect(() => {
    let ctx = gsap.context(() => {
      gsap.from(".nos-hero", { y: 40, opacity: 0, duration: 1.2, stagger: 0.1, ease: "power3.out", delay: 0.2 });
      gsap.utils.toArray(".nos-scroll").forEach(el => {
        gsap.from(el, { scrollTrigger: { trigger: el, start: "top 85%" }, y: 40, opacity: 0, duration: 0.8, ease: "power3.out" });
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  const valores = [
    {
      icon: <Building size={28} />,
      title: "Trayectoria",
      desc: "Más de 30 años construyendo confianza en Villa Ballester y la zona norte del Gran Buenos Aires. Cada proyecto refleja nuestra historia.",
      data: "+30 años"
    },
    {
      icon: <ArrowRight size={28} />,
      title: "Innovación",
      desc: "Pioneros en financiamiento en pesos con cuotas accesibles. Facilitamos el acceso a la vivienda con soluciones flexibles y pensadas para cada cliente.",
      data: "Financiación propia"
    },
    {
      icon: <MapPin size={28} />,
      title: "Compromiso familiar",
      desc: "Somos una empresa de familia. Néstor fundó la base y Nahuel lleva adelante la visión de seguir creciendo juntos, con los mismos valores de siempre.",
      data: "Familia Ruiz"
    }
  ];

  const hitos = [
    { year: "2003", label: "Fundación", desc: "Néstor Ruiz funda Dinal Propiedades en Villa Ballester, con la visión de ser la inmobiliaria de referencia en la zona." },
    { year: "2007", label: "Grupo Dinal", desc: "Nace Grupo Dinal: la alianza entre la familia Ruiz y la familia Montanari une expertise comercial y trayectoria constructora." },
    { year: "Hoy", label: "Nueva generación", desc: "Nahuel Ruiz asume la conducción junto a su padre. La misma esencia, con mirada renovada y proyección hacia el futuro." }
  ];

  return (
    <div ref={containerRef} className="bg-[#F9FAFB] pt-32 pb-24 min-h-screen">

      {/* ── HERO ── */}
      <section className="px-6 lg:px-12 mb-24">
        <div className="max-w-7xl mx-auto rounded-[2rem] overflow-hidden relative h-[60vh] flex items-center justify-center shadow-2xl">
          <img src="/images/Size%20Optimized/_MG_1091.jpg" alt="Sobre Nosotros" className="absolute inset-0 w-full h-full object-cover scale-105 transition-all duration-1000" />
          <div className="absolute inset-0 bg-primary/75"></div>
          <div className="relative z-10 text-center px-4">
            <span className="nos-hero font-data tracking-widest text-xs text-white/70 mb-4 block">// NUESTRA HISTORIA</span>
            <h1 className="nos-hero font-drama font-black text-5xl md:text-7xl text-white mb-6">Más de 30 años<br /><span className="font-heading font-black text-accent tracking-tight">construyendo juntos.</span></h1>
            <p className="nos-hero font-heading text-lg text-white/80 max-w-xl mx-auto">Una empresa de familia, una historia de esfuerzo, y una visión compartida que trasciende generaciones.</p>
          </div>
        </div>
      </section>

      {/* ── HISTORIA ── */}
      <section className="px-6 lg:px-12 mb-32">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="nos-scroll font-data tracking-widest text-xs text-primary/50 mb-4 block">// LOS COMIENZOS</span>
            <h2 className="nos-scroll font-drama font-black text-4xl md:text-5xl text-primary mb-6 leading-tight">Una decisión <br />que cambió <br /><span className="text-accent">todo.</span></h2>
            <p className="nos-scroll font-heading text-dark/70 text-lg leading-relaxed mb-6">
              En 2003, Néstor Ruiz apostó a construir algo propio en Villa Ballester. Con esfuerzo, convicción y una vocación genuina por el servicio, fundó Dinal Propiedades — la inmobiliaria que se convertiría en referente de la zona norte del Gran Buenos Aires.
            </p>
            <p className="nos-scroll font-heading text-dark/70 text-lg leading-relaxed mb-6">
              En 2007 nació Grupo Dinal: la unión con la familia Montanari sumó expertise constructora a la solidez comercial. Juntos levantaron proyectos que hoy son hogar para miles de familias.
            </p>
            <p className="nos-scroll font-heading text-dark/70 text-lg leading-relaxed">
              Hoy, Nahuel —hijo de Néstor— conduce la empresa junto a su padre. Creció dentro de Dinal, aprendió los valores que la construyeron, y hoy lleva adelante esa herencia con una mirada moderna y el mismo compromiso de siempre.
            </p>
          </div>
          <div className="nos-scroll relative">
            <div className="rounded-[2rem] overflow-hidden shadow-2xl h-[480px]">
              <img src="/images/Size%20Optimized/_MG_2464.jpg" alt="Historia Dinal" className="w-full h-full object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-primary text-white px-6 py-4 rounded-2xl shadow-xl">
              <p className="font-data text-xs text-white/60 tracking-widest uppercase mb-1">Fundada en</p>
              <p className="font-drama font-black text-4xl text-accent">2003</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TIMELINE ── */}
      <section className="px-6 lg:px-12 mb-32">
        <div className="max-w-7xl mx-auto">
          <span className="nos-scroll font-data tracking-widest text-xs text-primary/50 mb-2 block text-center">// HITOS</span>
          <h2 className="nos-scroll font-drama font-black text-4xl md:text-5xl text-primary text-center mb-16">Nuestro camino</h2>
          <div className="relative">
            {/* Vertical line */}
            <div className="hidden lg:block absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-primary/10"></div>
            <div className="flex flex-col gap-16">
              {hitos.map((h, i) => (
                <div key={h.year} className={`nos-scroll flex flex-col lg:flex-row items-center gap-8 ${i % 2 !== 0 ? 'lg:flex-row-reverse' : ''}`}>
                  <div className={`flex-1 ${i % 2 !== 0 ? 'lg:text-right' : 'lg:text-left'}`}>
                    <span className="font-data text-xs text-primary/40 tracking-widest uppercase block mb-2">{h.label}</span>
                    <p className="font-heading text-dark/70 text-lg leading-relaxed">{h.desc}</p>
                  </div>
                  <div className="flex-shrink-0 relative z-10 flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-xl border-4 border-accent">
                      <span className="font-drama font-black text-accent text-xl leading-none">{h.year}</span>
                    </div>
                  </div>
                  <div className="flex-1 hidden lg:block"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── VALORES ── */}
      <section className="px-6 lg:px-12 mb-32">
        <div className="max-w-7xl mx-auto">
          <span className="nos-scroll font-data tracking-widest text-xs text-primary/50 mb-2 block text-center">// VALORES</span>
          <h2 className="nos-scroll font-drama font-black text-4xl md:text-5xl text-primary text-center mb-16">Lo que nos define</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {valores.map((v) => (
              <div key={v.title} className="nos-scroll bg-white p-8 rounded-[1.5rem] shadow border border-primary/10 hover:-translate-y-2 hover:border-accent transition-all duration-500 group flex flex-col">
                <div className="text-accent mb-4 group-hover:scale-110 transition-transform duration-300">{v.icon}</div>
                <h3 className="font-heading font-bold text-primary text-xl mb-3">{v.title}</h3>
                <p className="font-heading text-dark/60 leading-relaxed flex-grow">{v.desc}</p>
                <div className="mt-6 pt-4 border-t border-primary/10">
                  <span className="font-data text-xs tracking-widest text-primary/40 uppercase">{v.data}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="px-6 lg:px-12 mb-32">
        <div className="max-w-7xl mx-auto bg-primary rounded-[2rem] py-16 px-8 shadow-2xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 text-center">
            {[
              { value: "+30", label: "Años de experiencia" },
              { value: "78", label: "Proyectos en Pcia. de Bs. As." },
              { value: "+150.000", label: "m² entregados" },
              { value: "1.350", label: "Unidades vendidas" }
            ].map((s) => (
              <div key={s.label} className="nos-scroll">
                <p className="font-drama font-black text-5xl md:text-6xl text-accent mb-2">{s.value}</p>
                <p className="font-heading text-white/60 text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 lg:px-12">
        <div className="max-w-7xl mx-auto bg-primary rounded-[2rem] p-10 md:p-16 text-center shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="nos-scroll font-drama text-4xl md:text-5xl text-white mb-6">¿Querés conocernos mejor?</h2>
            <p className="nos-scroll font-heading text-white/70 max-w-2xl mx-auto mb-10 text-lg">Acercate a nuestras sucursales o contactanos. Estamos para asesorarte y acompañarte en cada paso de tu próxima inversión.</p>
            <Link to="/contacto" className="nos-scroll inline-block bg-transparent border-2 border-accent text-accent font-heading font-bold px-8 py-4 rounded-xl hover:bg-accent hover:text-primary transition-colors transform hover:scale-105 duration-300 shadow-xl">
              Hablemos
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
};

// ----------------------------------------------------
// ODM INQUIRY FORM  (uses Obras de Mar Tokko key)
// ----------------------------------------------------
const OdmInquiryForm = ({ propertyId }) => {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [status, setStatus] = useState('idle');

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch(
        `https://tokkobroker.com/api/v1/property/contact/?key=${import.meta.env.VITE_ODM_TOKKO_API_KEY}&format=json`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_ids: [propertyId],
            name: form.name,
            email: form.email,
            phone: form.phone,
            message: form.message || `Consulta sobre proyecto #${propertyId}`,
            tags: ['Web', 'ObrasDeMarMDP'],
          }),
        }
      );
      if (!res.ok) throw new Error('Error al enviar');
      setStatus('success');
      setForm({ name: '', email: '', phone: '', message: '' });
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="bg-accent/10 border border-accent/30 rounded-xl p-6 text-center">
        <p className="font-heading font-bold text-primary text-sm mb-1">¡Consulta enviada!</p>
        <p className="font-heading text-dark/60 text-xs">Nos comunicaremos a la brevedad.</p>
        <button onClick={() => setStatus('idle')} className="mt-4 font-heading text-xs text-primary/50 hover:text-primary transition-colors underline">
          Enviar otra consulta
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-2">
      <p className="font-heading font-semibold text-sm text-primary">Consultar por este proyecto</p>
      <input name="name" value={form.name} onChange={handleChange} required placeholder="Nombre completo"
        className="w-full border border-primary/15 rounded-xl px-4 py-2.5 font-heading text-sm text-primary placeholder-dark/30 focus:outline-none focus:border-accent transition-colors" />
      <input name="email" type="email" value={form.email} onChange={handleChange} required placeholder="Email"
        className="w-full border border-primary/15 rounded-xl px-4 py-2.5 font-heading text-sm text-primary placeholder-dark/30 focus:outline-none focus:border-accent transition-colors" />
      <input name="phone" value={form.phone} onChange={handleChange} placeholder="Teléfono (opcional)"
        className="w-full border border-primary/15 rounded-xl px-4 py-2.5 font-heading text-sm text-primary placeholder-dark/30 focus:outline-none focus:border-accent transition-colors" />
      <textarea name="message" value={form.message} onChange={handleChange} placeholder="Mensaje (opcional)" rows={3}
        className="w-full border border-primary/15 rounded-xl px-4 py-2.5 font-heading text-sm text-primary placeholder-dark/30 focus:outline-none focus:border-accent transition-colors resize-none" />
      {status === 'error' && (
        <p className="font-heading text-xs text-red-500">Hubo un error. Intentá de nuevo o escribinos por WhatsApp.</p>
      )}
      <button type="submit" disabled={status === 'sending'}
        className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-heading font-bold px-6 py-3 rounded-xl transition-colors">
        {status === 'sending' ? 'Enviando…' : 'Solicitar información'}
      </button>
    </form>
  );
};

// ----------------------------------------------------
// OBRAS DE MAR — LANDING
// ----------------------------------------------------
const ObrasDeMarLanding = () => {
  const containerRef = useRef(null);
  const [devs, setDevs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useLayoutEffect(() => {
    let ctx = gsap.context(() => {
      gsap.from('.odm-hero', { y: 40, opacity: 0, duration: 1, stagger: 0.1, ease: 'power3.out' });
      gsap.utils.toArray('.odm-scroll').forEach(el => {
        gsap.from(el, {
          scrollTrigger: { trigger: el, start: 'top 85%' },
          y: 40, opacity: 0, duration: 0.8, ease: 'power3.out',
        });
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const ODM_KEY = import.meta.env.VITE_ODM_TOKKO_API_KEY;
    fetchWithCache(
      '/data/odm-developments.json',
      `https://tokkobroker.com/api/v1/development/?key=${ODM_KEY}&lang=es_ar&format=json&limit=100`
    )
      .then(all => setDevs(all))
      .catch(err => console.error('ODM developments fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  const heroImg = devs.length > 0 && devs[0]?.photos?.length > 0
    ? devs[0].photos[0].image
    : '/images/Size%20Optimized/_MG_4682.jpg';

  const whyInvest = [
    {
      icon: '💰',
      title: '30% de entrada',
      desc: 'Cuotas en pesos ajustadas por índice CAC. Una forma accesible y transparente de hacer crecer tu capital.',
    },
    {
      icon: '🏗️',
      title: '+30 años de trayectoria',
      desc: 'Grupo Dinal lleva más de tres décadas construyendo con calidad, cumpliendo plazos y entregando lo que promete.',
    },
    {
      icon: '🤝',
      title: 'Proceso acompañado',
      desc: 'Te asesoramos en cada etapa: desde la elección del proyecto hasta la escritura. Sin sorpresas, sin letras chicas.',
    },
  ];

  return (
    <div ref={containerRef} className="bg-[#F9FAFB] pb-24 min-h-screen">

      {/* ── HERO ── */}
      <section className="relative h-[100dvh] w-full flex items-end pb-24 lg:pb-32 px-6 lg:px-12 overflow-hidden bg-primary mb-20">
        <div className="absolute inset-0 z-0">
          <img src={heroImg} alt="Obras de Mar" className="w-full h-full object-cover scale-105 origin-center opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/80 to-transparent"></div>
        </div>
        <div className="relative z-10 w-full max-w-6xl mx-auto">
          <h1 className="text-background flex flex-col gap-4">
            <span className="odm-hero font-drama font-black text-5xl md:text-7xl lg:text-8xl leading-none md:leading-[1.1] text-white drop-shadow-md pb-2">
              <span className="font-normal">Invertí en pozo</span> con los que saben.
              <div className="h-1 w-24 bg-accent mt-8 mb-2"></div>
            </span>
            <span className="odm-hero font-heading font-normal italic text-2xl md:text-3xl text-background/90">Desarrollos en Mar del Plata</span>
          </h1>
          <p className="odm-hero mt-6 text-background/80 font-heading text-lg max-w-xl">
            Más de 30 años construyendo con Grupo Dinal. Proyectos en pozo en las mejores zonas de la Costa Atlántica.
          </p>
          <div className="odm-hero mt-10">
            <a href="#proyectos" className="group inline-flex items-center gap-4 border border-white text-white px-8 py-4 rounded-full font-heading font-bold text-lg hover:border-accent hover:text-accent hover:scale-[1.02] transition-all duration-300">
              Ver proyectos
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="px-6 lg:px-12 mb-24 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { value: '+30', label: 'Años de trayectoria', sub: 'Grupo Dinal' },
            { value: devs.length > 0 ? String(devs.length) : '4', label: 'Proyectos activos', sub: 'en Mar del Plata' },
            { value: 'USD 46.500', label: 'Desde', sub: '1 ambiente · Punta de Arenas XVII' },
          ].map(s => (
            <div key={s.label} className="odm-scroll bg-white rounded-2xl p-8 border border-primary/10 text-center shadow-sm">
              <p className="font-drama font-black text-5xl text-primary mb-1">{s.value}</p>
              <p className="font-heading font-bold text-primary text-sm uppercase tracking-wider mb-1">{s.label}</p>
              <p className="font-heading text-dark/50 text-xs">{s.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PROJECTS GRID ── */}
      <section id="proyectos" className="px-6 lg:px-12 mb-24 max-w-7xl mx-auto">
        <span className="odm-scroll font-data tracking-widest text-xs text-primary/50 mb-2 block">// NUESTROS DESARROLLOS</span>
        <h2 className="odm-scroll font-drama font-black text-4xl md:text-5xl text-primary mb-12">Proyectos en pozo</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-[1rem] p-4 shadow-sm border border-primary/10 animate-pulse">
                <div className="w-full h-[250px] rounded-lg bg-primary/10 mb-6"></div>
                <div className="h-5 bg-primary/10 rounded mb-2 w-3/4"></div>
                <div className="h-4 bg-primary/10 rounded mb-2 w-1/2"></div>
                <div className="h-4 bg-primary/10 rounded w-1/3"></div>
              </div>
            ))
          ) : devs.length > 0 ? (
            devs.map(dev => (
              <Link
                key={dev.id}
                to={`/obras-de-mar/propiedad/${propSlug(dev)}`}
                className="odm-scroll bg-white rounded-[1rem] p-4 shadow-sm border border-primary/10 hover:shadow-xl hover:-translate-y-2 hover:border-accent transition-all duration-300 group cursor-pointer relative flex flex-col h-full"
              >
                <div className="absolute top-8 left-8 z-10 bg-primary text-white font-heading font-bold px-3 py-1 rounded-sm text-xs uppercase tracking-wider">
                  {odmConstructionLabel(dev)}
                </div>
                <div className="w-full h-[250px] rounded-lg overflow-hidden mb-6 relative">
                  <img
                    src={dev.photos?.[0]?.image || '/images/Size%20Optimized/_MG_4682.jpg'}
                    alt={dev.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                </div>
                <div className="px-2 flex-grow flex flex-col">
                  <h3 className="font-heading font-bold text-xl text-primary mb-2 line-clamp-2">{dev.name}</h3>
                  <p className="font-heading text-sm text-dark/60 mb-6 flex items-center gap-2">
                    <MapPin size={16} /> {dev.location?.name ?? 'Mar del Plata'}
                  </p>
                  <div className="mt-auto pt-4 border-t border-primary/10 flex items-center justify-between">
                    <span className="font-heading font-bold text-primary">Ver Proyecto</span>
                    <ArrowRight size={18} className="text-accent group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-3 text-center py-24">
              <Building size={48} className="text-primary/20 mx-auto mb-4" />
              <p className="font-heading text-dark/50">No hay proyectos disponibles en este momento.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── WHY INVEST ── */}
      <section className="px-6 lg:px-12 mb-24 max-w-7xl mx-auto">
        <span className="odm-scroll font-data tracking-widest text-xs text-primary/50 mb-2 block text-center">// POR QUÉ INVERTIR</span>
        <h2 className="odm-scroll font-drama font-black text-4xl md:text-5xl text-primary text-center mb-16">Lo que nos diferencia</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {whyInvest.map((item, i) => (
            <div key={i} className="odm-scroll bg-white p-8 rounded-[1.5rem] shadow border border-primary/10 hover:-translate-y-2 hover:border-accent transition-all duration-500 group flex flex-col">
              <span className="text-4xl mb-5 block">{item.icon}</span>
              <h3 className="font-heading font-bold text-primary text-xl mb-3">{item.title}</h3>
              <p className="font-heading text-dark/60 leading-relaxed flex-grow">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 lg:px-12">
        <div className="max-w-7xl mx-auto bg-primary rounded-[2rem] p-10 md:p-16 text-center shadow-2xl relative overflow-hidden">
          <div className="relative z-10">
            <span className="odm-scroll font-data tracking-widest text-xs text-white/50 mb-4 block">// CONTACTO MAR DEL PLATA</span>
            <h2 className="odm-scroll font-drama text-4xl md:text-5xl text-white mb-4">¿Listo para dar<br />el primer paso?</h2>
            <p className="odm-scroll font-heading text-white/70 max-w-xl mx-auto mb-10 text-lg">
              Charlemos sobre tu inversión. Estamos en Güemes 2305, Mar del Plata, o escribinos por WhatsApp.
            </p>
            <div className="odm-scroll flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a
                href="https://wa.me/5491176027596?text=Hola%2C%20quería%20más%20información%20sobre%20los%20desarrollos%20de%20Obras%20de%20Mar."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-heading font-bold px-8 py-4 rounded-full transition-colors duration-300 shadow-xl"
              >
                <svg viewBox="0 0 24 24" width={20} height={20} fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp Mar del Plata
              </a>
              <Link to="/contacto" className="inline-block border-2 border-accent text-accent font-heading font-bold px-8 py-4 rounded-full hover:bg-accent hover:text-primary transition-colors duration-300">
                Formulario de contacto
              </Link>
            </div>
            <p className="odm-scroll font-heading text-white/40 text-sm mt-8">Güemes 2305, Mar del Plata · L–V 10:00–13:00 / 14:00–18:00</p>
          </div>
        </div>
      </section>

    </div>
  );
};

// ----------------------------------------------------
// OBRAS DE MAR — PROPERTY DETAIL
// ----------------------------------------------------
const ObrasDeMarPropertyDetail = () => {
  const { id: rawSlug } = useParams();
  const id = rawSlug.split('-')[0];
  const navigate = useNavigate();
  const [prop, setProp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    setProp(null);

    // 1. Try ODM properties cache
    fetch('/data/odm-properties.json')
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        const arr = Array.isArray(data) ? data : (data.objects ?? []);
        const found = arr.find(x => String(x.id) === String(id));
        if (found) { setProp(found); setLoading(false); return; }
        // 2. Try ODM developments cache
        return fetch('/data/odm-developments.json')
          .then(r => r.json())
          .then(data2 => {
            const arr2 = Array.isArray(data2) ? data2 : (data2.objects ?? []);
            const found2 = arr2.find(x => String(x.id) === String(id));
            if (found2) { setProp(found2); setLoading(false); }
            else throw new Error('not in ODM cache');
          });
      })
      .catch(() => {
        // 3. Fallback: live ODM Tokko API
        const key = import.meta.env.VITE_ODM_TOKKO_API_KEY;
        Promise.allSettled([
          fetch(`https://tokkobroker.com/api/v1/property/${id}/?key=${key}&lang=es_ar&format=json`).then(r => r.json()),
          fetch(`https://tokkobroker.com/api/v1/development/${id}/?key=${key}&lang=es_ar&format=json`).then(r => r.json()),
        ]).then(([propRes, devRes]) => {
          const propData = propRes.status === 'fulfilled' && propRes.value?.id ? propRes.value : null;
          const devData  = devRes.status  === 'fulfilled' && devRes.value?.id  ? devRes.value  : null;
          setProp(propData ?? devData ?? null);
        }).finally(() => setLoading(false));
      });
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-[#F9FAFB] pt-32 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-accent rounded-full animate-spin" />
        <p className="font-heading text-dark/50">Cargando proyecto…</p>
      </div>
    </div>
  );

  if (!prop) return (
    <div className="min-h-screen bg-[#F9FAFB] pt-32 flex items-center justify-center flex-col gap-4">
      <Building size={64} className="text-primary/20" />
      <h1 className="font-heading font-bold text-2xl text-primary">Proyecto no encontrado</h1>
      <button onClick={() => navigate('/obras-de-mar')} className="font-heading text-accent underline">Volver a Obras de Mar</button>
    </div>
  );

  const op     = prop.operations?.[0];
  const price  = op?.prices?.[0];
  const photos = prop.photos ?? [];
  const title  = prop.publication_title ?? prop.name ?? '';
  const lat    = prop.geo_lat  ?? prop.location?.lat;
  const lon    = prop.geo_long ?? prop.location?.lon;

  const tagsByType = (prop.tags ?? []).reduce((acc, t) => {
    if (!acc[t.type]) acc[t.type] = [];
    acc[t.type].push(t.name);
    return acc;
  }, {});

  const specs = [
    { label: 'Tipo',             value: prop.property_type?.name },
    { label: 'Ambientes',        value: prop.room_amount },
    { label: 'Dormitorios',      value: prop.suite_amount },
    { label: 'Baños',            value: prop.bathroom_amount },
    { label: 'Cocheras',         value: prop.parking_lot_amount },
    { label: 'Sup. cubierta',    value: prop.roofed_surface    ? `${prop.roofed_surface} m²`    : null },
    { label: 'Sup. descubierta', value: prop.unroofed_surface  ? `${prop.unroofed_surface} m²`  : null },
    { label: 'Sup. semicubierta',value: prop.semiroofed_surface ? `${prop.semiroofed_surface} m²` : null },
    { label: 'Sup. total',       value: prop.total_surface     ? `${prop.total_surface} m²`     : null },
    { label: 'Estado',           value: prop.property_condition ?? odmConstructionLabel(prop) },
    { label: 'Antigüedad',       value: prop.age },
    { label: 'Expensas',         value: prop.expenses ? `ARS ${Number(prop.expenses).toLocaleString('es-AR')}` : null },
  ].filter(s => s.value != null && s.value !== '' && s.value !== 0);

  return (
    <div className="min-h-screen bg-[#F9FAFB] pt-28 pb-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">

        {/* Back */}
        <button
          onClick={() => navigate('/obras-de-mar')}
          className="flex items-center gap-2 text-dark/50 hover:text-primary font-heading text-sm mb-8 transition-colors group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Volver a Obras de Mar
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">

          {/* ── MAIN COLUMN ── */}
          <div className="lg:col-span-2 flex flex-col gap-8">

            {/* Gallery */}
            {photos.length > 0 && (
              <div>
                <div className="relative rounded-2xl overflow-hidden bg-primary/10 h-[420px] md:h-[500px]">
                  <img src={photos[activePhoto]?.image} alt={title} className="w-full h-full object-cover transition-opacity duration-300" />
                  {photos.length > 1 && (
                    <>
                      <button onClick={() => setActivePhoto(i => (i - 1 + photos.length) % photos.length)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors">
                        <ChevronLeft size={22} />
                      </button>
                      <button onClick={() => setActivePhoto(i => (i + 1) % photos.length)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-2 transition-colors">
                        <ChevronRight size={22} />
                      </button>
                      <span className="absolute bottom-3 right-3 bg-black/50 text-white text-xs font-data px-3 py-1 rounded-full">
                        {activePhoto + 1} / {photos.length}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                  {photos.map((ph, i) => (
                    <button key={i} onClick={() => setActivePhoto(i)}
                      className={`shrink-0 h-16 w-24 rounded-lg overflow-hidden border-2 transition-all ${i === activePhoto ? 'border-accent' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                      <img src={ph.thumb ?? ph.image} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Header */}
            <div className="bg-white rounded-2xl p-8 border border-primary/10">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {op?.operation_type && (
                  <span className="bg-primary text-white font-heading font-bold text-xs px-3 py-1 rounded-full uppercase tracking-wider">{op.operation_type}</span>
                )}
                {prop.property_type?.name && (
                  <span className="bg-primary/5 text-primary font-heading font-bold text-xs px-3 py-1 rounded-full">{prop.property_type.name}</span>
                )}
                <span className="bg-accent/20 text-primary font-heading font-bold text-xs px-3 py-1 rounded-full">Obras de Mar</span>
                <span className="ml-auto font-data text-xs text-dark/40 tracking-widest">REF: {prop.reference_code ?? prop.id}</span>
              </div>
              <h1 className="font-heading font-black text-2xl md:text-3xl text-primary mb-3 leading-snug">{title}</h1>
              {(prop.address || prop.location?.name) && (
                <p className="font-heading text-dark/60 flex items-center gap-1.5 text-sm">
                  <MapPin size={15} className="text-accent shrink-0" />
                  {prop.address ? `${prop.address}${prop.location?.name ? `, ${prop.location.name}` : ''}` : prop.location?.name}
                </p>
              )}
            </div>

            {/* Specs */}
            {specs.length > 0 && (
              <div className="bg-white rounded-2xl p-8 border border-primary/10">
                <h2 className="font-heading font-bold text-lg text-primary mb-6 pb-3 border-b border-primary/10">Características</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
                  {specs.map(s => (
                    <div key={s.label}>
                      <p className="font-data text-xs text-dark/40 tracking-widest uppercase mb-0.5">{s.label}</p>
                      <p className="font-heading font-semibold text-primary">{s.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {(prop.enhanced_description || prop.rich_description || prop.description) && (
              <div className="bg-white rounded-2xl p-8 border border-primary/10">
                <h2 className="font-heading font-bold text-lg text-primary mb-4 pb-3 border-b border-primary/10">Descripción</h2>
                {prop.enhanced_description || prop.rich_description ? (
                  <div className="font-heading text-dark/70 leading-relaxed text-sm property-description"
                    dangerouslySetInnerHTML={{ __html: prop.enhanced_description || prop.rich_description }} />
                ) : (
                  <p className="font-heading text-dark/70 leading-relaxed whitespace-pre-line text-sm">{prop.description}</p>
                )}
              </div>
            )}

            {/* Amenities */}
            {Object.keys(tagsByType).length > 0 && (
              <div className="bg-white rounded-2xl p-8 border border-primary/10">
                <h2 className="font-heading font-bold text-lg text-primary mb-6 pb-3 border-b border-primary/10">Comodidades</h2>
                <div className="flex flex-col gap-6">
                  {Object.entries(tagsByType).map(([type, names]) => (
                    <div key={type}>
                      <p className="font-data text-xs text-dark/40 tracking-widest uppercase mb-3">{TAG_TYPE_LABELS[type] ?? type}</p>
                      <div className="flex flex-wrap gap-2">
                        {names.map(name => (
                          <span key={name} className="inline-flex items-center gap-1.5 bg-primary/5 text-primary font-heading text-sm px-3 py-1.5 rounded-lg border border-primary/10">
                            <span className="text-primary/50 shrink-0">{TAG_ICONS[name] ?? <Check size={14} />}</span>
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Map */}
            {lat && lon && import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
              <div className="bg-white rounded-2xl overflow-hidden border border-primary/10">
                <div className="p-6 pb-0">
                  <h2 className="font-heading font-bold text-lg text-primary mb-4">Ubicación</h2>
                </div>
                <iframe title="Mapa de ubicación" width="100%" height="320"
                  style={{ border: 0, display: 'block' }} loading="lazy" allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&q=${lat},${lon}&zoom=15`}
                />
              </div>
            )}
          </div>

          {/* ── SIDEBAR ── */}
          <div className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">

            {/* Price + CTA */}
            <div className="bg-white rounded-2xl p-8 border border-primary/10 shadow-sm">
              {price && (
                <div className="mb-6 pb-6 border-b border-primary/10">
                  <p className="font-data text-xs text-dark/40 tracking-widest uppercase mb-1">Precio</p>
                  <p className="font-drama font-black text-4xl text-primary leading-none">
                    {price.currency} {Number(price.price).toLocaleString('es-AR')}
                  </p>
                  {prop.expenses && (
                    <p className="font-heading text-xs text-dark/50 mt-2">
                      + Expensas ARS {Number(prop.expenses).toLocaleString('es-AR')}
                    </p>
                  )}
                </div>
              )}

              <p className="font-heading font-semibold text-sm text-primary mb-3">Consultar por WhatsApp</p>
              <div className="flex flex-col gap-2 mb-5">
                <a
                  href={`https://wa.me/5491176027596?text=${encodeURIComponent(`Hola, quería más información sobre este proyecto: ${window.location.href}`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-heading font-semibold text-sm px-4 py-3 rounded-xl transition-colors"
                >
                  {WA_ICON}
                  Mar del Plata
                </a>
              </div>

              <OdmInquiryForm propertyId={prop.id} />
            </div>

            {/* ODM Office */}
            <div className="bg-white rounded-2xl p-8 border border-primary/10">
              <h3 className="font-heading font-bold text-sm text-primary mb-5 pb-3 border-b border-primary/10 uppercase tracking-wider">Oficina Mar del Plata</h3>
              <div className="flex items-start gap-3">
                <div className="bg-primary/5 p-2 rounded-lg text-accent shrink-0 mt-0.5"><MapPin size={16} /></div>
                <div>
                  <p className="font-heading font-semibold text-primary text-sm">Obras de Mar</p>
                  <p className="font-heading text-xs text-dark/60">Güemes 2305, Mar del Plata</p>
                  <a href="tel:+5491176027596" className="font-heading text-xs text-primary/60 hover:text-primary transition-colors">+54 9 11 7602-7596</a>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [propAddress, setPropAddress] = useState(null);
  return (
    <PropertyCtx.Provider value={{ address: propAddress, setAddress: setPropAddress }}>
    <Router>
      <div className="bg-background min-h-screen relative selection:bg-accent selection:text-primary">
        <Navbar />
        <WhatsAppButton />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/contacto" element={<Contact />} />
          <Route path="/emprendimientos" element={<Emprendimientos />} />
          <Route path="/alquiler" element={<Alquiler />} />
          <Route path="/venta" element={<Ventas />} />
          <Route path="/sucursales" element={<Sucursales />} />
          <Route path="/nosotros" element={<SobreNosotros />} />
          <Route path="/propiedad/:id" element={<PropertyDetail />} />
          <Route path="/emprendimientos/terminado/:slug" element={<TerminadoDetail />} />
          <Route path="/obras-de-mar" element={<ObrasDeMarLanding />} />
          <Route path="/obras-de-mar/propiedad/:id" element={<ObrasDeMarPropertyDetail />} />
        </Routes>
        <Footer />
      </div>
    </Router>
    </PropertyCtx.Provider>
  );
}
