import {
  Playfair_Display,
  Comfortaa,
  Outfit,
  DM_Sans,
  Source_Sans_3,
  IBM_Plex_Sans,
  Poppins,
  Sora,
  Figtree,
  Montserrat,
  Anton,
  Barlow,
  Fredoka,
  Baloo_2,
  Varela_Round,
  Lilita_One,
  Luckiest_Guy,
  Bungee,
  Righteous,
  Rubik,
  Dancing_Script,
  Caveat,
  Pacifico,
  Sacramento,
  Great_Vibes,
  Satisfy,
  Allura,
  Kaushan_Script,
} from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});
const comfortaa = Comfortaa({
  subsets: ["latin"],
  variable: "--font-comfortaa",
  display: "swap",
});
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});
const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--font-fredoka",
  display: "swap",
});
const baloo2 = Baloo_2({
  subsets: ["latin"],
  variable: "--font-baloo2",
  display: "swap",
});
const varelaRound = Varela_Round({
  subsets: ["latin"],
  variable: "--font-varela-round",
  weight: ["400"],
  display: "swap",
});
const lilitaOne = Lilita_One({
  subsets: ["latin"],
  variable: "--font-lilita-one",
  weight: ["400"],
  display: "swap",
});
const luckiestGuy = Luckiest_Guy({
  subsets: ["latin"],
  variable: "--font-luckiest-guy",
  weight: ["400"],
  display: "swap",
});
const bungee = Bungee({
  subsets: ["latin"],
  variable: "--font-bungee",
  weight: ["400"],
  display: "swap",
});
const righteous = Righteous({
  subsets: ["latin"],
  variable: "--font-righteous",
  weight: ["400"],
  display: "swap",
});
const rubik = Rubik({
  subsets: ["latin"],
  variable: "--font-rubik",
  display: "swap",
});
const dancingScript = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-dancing-script",
  display: "swap",
});
const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});
const sourceSans3 = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans-3",
  display: "swap",
});
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
  weight: ["400", "600"],
  display: "swap",
});
const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["400", "600"],
  display: "swap",
});
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});
const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});
const anton = Anton({
  subsets: ["latin"],
  variable: "--font-anton",
  weight: ["400"],
  display: "swap",
});
const barlow = Barlow({
  subsets: ["latin"],
  variable: "--font-barlow",
  weight: ["400", "600"],
  display: "swap",
});
const pacifico = Pacifico({
  subsets: ["latin"],
  variable: "--font-pacifico",
  weight: ["400"],
  display: "swap",
});
const sacramento = Sacramento({
  subsets: ["latin"],
  variable: "--font-sacramento",
  weight: ["400"],
  display: "swap",
});
const greatVibes = Great_Vibes({
  subsets: ["latin"],
  variable: "--font-great-vibes",
  weight: ["400"],
  display: "swap",
});
const satisfy = Satisfy({
  subsets: ["latin"],
  variable: "--font-satisfy",
  weight: ["400"],
  display: "swap",
});
const allura = Allura({
  subsets: ["latin"],
  variable: "--font-allura",
  weight: ["400"],
  display: "swap",
});
const kaushanScript = Kaushan_Script({
  subsets: ["latin"],
  variable: "--font-kaushan-script",
  weight: ["400"],
  display: "swap",
});

export default function FontPreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${playfair.variable} ${comfortaa.variable} ${outfit.variable} ${dmSans.variable} ${sourceSans3.variable} ${ibmPlexSans.variable} ${poppins.variable} ${sora.variable} ${figtree.variable} ${montserrat.variable} ${anton.variable} ${barlow.variable} ${fredoka.variable} ${baloo2.variable} ${varelaRound.variable} ${lilitaOne.variable} ${luckiestGuy.variable} ${bungee.variable} ${righteous.variable} ${rubik.variable} ${dancingScript.variable} ${caveat.variable} ${pacifico.variable} ${sacramento.variable} ${greatVibes.variable} ${satisfy.variable} ${allura.variable} ${kaushanScript.variable}`}
    >
      {children}
    </div>
  );
}
