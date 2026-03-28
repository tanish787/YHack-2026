/**
 * English stop words omitted from "content word" frequency lists.
 */
const RAW = `
a an the and or but if in on at to for of as by with from up about into through during before
after above below between under again further then once here there when where why how all both
each few more most other some such no nor not only own same so than too very can will just
don should now i me my we our you your he him his she her it its they them their what which
who this that these those am is are was were be been being have has had having do does did doing
would could ought
`;

export const STOPWORDS = new Set(
  RAW.split(/\s+/).map((w) => w.trim().toLowerCase()).filter(Boolean),
);
