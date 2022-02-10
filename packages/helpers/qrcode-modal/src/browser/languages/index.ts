import { TextMap } from "../types";

import de from "./de";
import en from "./en";
import es from "./es";
import fr from "./fr";
import ko from "./ko";
import pt from "./pt";
import zh from "./zh";
import fa from "./fa";
import zh_tw from "./zh_tw";

const languages: { [lang: string]: TextMap } = { de, en, es, fr, ko, pt, zh, fa, zh_tw };

export default languages;
