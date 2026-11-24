export type ArtImage = {
  mainImage: string;
  shareDate: string;
  title: string;
  attr: string;
  authorImage: string;
  author: string;
  authorYears: string;
  content: string[];
};

/** The painting shown before DailyArt answers, and when it cannot be read. */
export const DEFAULT_ART: ArtImage = {
  mainImage: "/images/main-image.webp",
  shareDate: "01 July 2023",
  title: "The Red Buoy, Saint-Tropez",
  attr: "Oil on canvas • 81 × 65 cm",
  authorImage: "/images/main-author.webp",
  author: "Paul Signac",
  authorYears: "1895",
  content: [
    "Hello July!",
    "Time for an artist who in my opinion, created one of the best images of Summer ... the French Pointillist, Paul Signac!",
    "Signac was a painter and an avid sailor. He created several marine paintings, including a series of views over the port of Saint-Tropez, where he settled in 1892.",
    "In this vertical painting, the eye initially fixes on the vibrant red-orange buoy, which contrasts with the water's deep blue. The reflections of the buildings then lead the viewer's eye to the background, with lighter tones. The divisionist technique and the combination of pure colors allowed Signac to depict a glittering sea, and the glimmering light of the Midi.",
    "The Pointillist painters differ from the Impressionists, most notably in the scientific dimension of their work. Regarding the rigor of his initial work, Signac's strokes have widened for this series; the division of tones is more relaxed.",
    "P.S. Our sale is on! Save 20% on our Prints Collection and order a high-quality reproduction of the greatest masterpieces.",
  ],
};
