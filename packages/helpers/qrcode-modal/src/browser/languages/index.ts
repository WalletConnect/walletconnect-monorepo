import { TextMap } from "../types";
import de from "./de";
import en from "./en";
import es from "./es";
import fa from "./fa";
import fr from "./fr";
import ko from "./ko";
import pt from "./pt";
import zh from "./zh";

const languages: { [lang: string]: TextMap } = { de, en, es, fa, fr, ko, pt, zh };

export default languages;
