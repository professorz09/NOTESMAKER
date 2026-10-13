// Static UPSC true/false facts for the "Quiz flash" mini game.
export interface Fact { subject: 'Polity' | 'History' | 'Geography' | 'Economy' | 'Environment'; q: string; answer: boolean; why: string }

export const FACTS: Fact[] = [
  // Polity
  { subject: 'Polity', q: 'The Preamble of the Indian Constitution has been amended only once.', answer: true, why: 'The 42nd Amendment (1976) added "socialist", "secular" and "integrity".' },
  { subject: 'Polity', q: 'The President can dissolve the Rajya Sabha.', answer: false, why: 'The Rajya Sabha is a permanent House; one-third of its members retire every two years.' },
  { subject: 'Polity', q: 'Article 32 lets a person move the Supreme Court directly to enforce Fundamental Rights.', answer: true, why: 'Dr Ambedkar called Article 32 the "heart and soul" of the Constitution.' },
  { subject: 'Polity', q: 'Fundamental Duties were part of the original Constitution of 1950.', answer: false, why: 'They were added as Article 51A by the 42nd Amendment in 1976.' },
  { subject: 'Polity', q: 'A Money Bill can be introduced only in the Lok Sabha.', answer: true, why: 'Article 109: a Money Bill cannot be introduced in the Rajya Sabha.' },
  { subject: 'Polity', q: 'State legislators take part in electing the Vice-President.', answer: false, why: 'The Vice-President is elected only by members of both Houses of Parliament.' },
  { subject: 'Polity', q: 'The minimum age to become a member of the Rajya Sabha is 30 years.', answer: true, why: 'Article 84 sets 30 years for the Rajya Sabha and 25 for the Lok Sabha.' },
  { subject: 'Polity', q: 'The Comptroller and Auditor General is appointed by the Prime Minister.', answer: false, why: 'Under Article 148 the CAG is appointed by the President.' },
  // History
  { subject: 'History', q: 'The first session of the Indian National Congress was held in Bombay in 1885.', answer: true, why: 'It met in Bombay under W. C. Bonnerjee, with A. O. Hume as a founder.' },
  { subject: 'History', q: 'Gandhi began the Dandi March from Sabarmati Ashram in 1932.', answer: false, why: 'The Dandi March began on 12 March 1930.' },
  { subject: 'History', q: 'The Permanent Settlement of Bengal was introduced by Lord Cornwallis in 1793.', answer: true, why: 'It fixed the land revenue payable by zamindars in perpetuity.' },
  { subject: 'History', q: "Ashoka's Brahmi inscriptions were first deciphered by William Jones.", answer: false, why: 'James Prinsep deciphered the Brahmi script in 1837.' },
  { subject: 'History', q: 'The Battle of Plassey was fought in 1757.', answer: true, why: 'Robert Clive defeated Siraj-ud-Daulah, Nawab of Bengal.' },
  { subject: 'History', q: 'The Quit India Movement was launched in 1920.', answer: false, why: 'It was launched in August 1942; 1920 saw the Non-Cooperation Movement.' },
  // Geography
  { subject: 'Geography', q: 'The Tropic of Cancer passes through eight Indian states.', answer: true, why: 'Gujarat, Rajasthan, MP, Chhattisgarh, Jharkhand, West Bengal, Tripura and Mizoram.' },
  { subject: 'Geography', q: 'The Narmada flows east into the Bay of Bengal.', answer: false, why: 'It flows west through a rift valley into the Arabian Sea (Gulf of Khambhat).' },
  { subject: 'Geography', q: 'Mawsynram in Meghalaya is among the wettest places on Earth.', answer: true, why: 'Moist monsoon winds rise over the Khasi Hills and shed heavy rain there.' },
  { subject: 'Geography', q: 'The Western Ghats are older than the Aravalli Range.', answer: false, why: 'The Aravallis are among the oldest fold mountains in the world.' },
  { subject: 'Geography', q: "Barren Island in the Andaman Sea is India's only confirmed active volcano.", answer: true, why: 'It lies east of the Andaman Islands and has erupted several times since 1991.' },
  { subject: 'Geography', q: 'The Palk Strait separates India from the Maldives.', answer: false, why: 'The Palk Strait lies between Tamil Nadu and Sri Lanka.' },
  // Economy
  { subject: 'Economy', q: "The RBI's Monetary Policy Committee has six members.", answer: true, why: 'Three from the RBI (including the Governor) and three appointed by the Centre.' },
  { subject: 'Economy', q: 'GST was rolled out in India on 1 April 2017.', answer: false, why: 'GST came into force on 1 July 2017, after the 101st Amendment.' },
  { subject: 'Economy', q: 'The Finance Commission is constituted under Article 280.', answer: true, why: 'The President constitutes it every five years or earlier.' },
  { subject: 'Economy', q: 'Raising the Cash Reserve Ratio increases the money banks can lend.', answer: false, why: 'A higher CRR locks more deposits with the RBI, so banks can lend less.' },
  { subject: 'Economy', q: 'NITI Aayog replaced the Planning Commission in 2015.', answer: true, why: 'It was set up on 1 January 2015 by a Union Cabinet resolution.' },
  // Environment
  { subject: 'Environment', q: 'The Ramsar Convention is about the conservation of wetlands.', answer: true, why: 'It was signed in Ramsar, Iran, in 1971.' },
  { subject: 'Environment', q: 'The Kyoto Protocol deals with ozone-depleting substances.', answer: false, why: 'Kyoto covers greenhouse gases; ozone-depleting substances fall under the Montreal Protocol.' },
  { subject: 'Environment', q: 'Silent Valley National Park is in Kerala.', answer: true, why: 'It lies in the Nilgiri Hills in Palakkad district.' },
  { subject: 'Environment', q: 'The IUCN lists the Great Indian Bustard as Vulnerable.', answer: false, why: 'It is listed as Critically Endangered.' },
  { subject: 'Environment', q: 'Kaziranga National Park is famous for the one-horned rhinoceros.', answer: true, why: 'It holds about two-thirds of the world’s greater one-horned rhinos.' },
];
