import { translate } from "../platform/translations.js";
export type Language = "en" | "ro";
export type Translate = (
  key: string,
  values?: Record<string, unknown>,
) => string;
const copy: Record<string, [string, string]> = {
  "brand.tagline": [
    "A little practice. A world of discovery.",
    "Puțin exercițiu. O lume de descoperiri.",
  ],
  "entry.eyebrow": [
    "SMALL STEPS. BIG DISCOVERIES.",
    "PAȘI MICI. DESCOPERIRI MARI.",
  ],
  "entry.title": [
    "A little practice, a lot of possibility.",
    "Puțin exercițiu, multe posibilități.",
  ],
  "entry.subtitle": [
    "Thoughtful activities for curious minds. Pick up where you left off with the codes from your teacher.",
    "Activități pentru minți curioase. Continuă învățarea cu codurile primite de la profesor.",
  ],
  "entry.form": [
    "Your next discovery starts here",
    "Următoarea descoperire începe aici",
  ],
  "entry.help": [
    "Two codes, one little adventure. Ask your teacher if you need a hand.",
    "Două coduri, o mică aventură. Cere ajutorul profesorului dacă ai nevoie.",
  ],
  "entry.teacher": ["A space for teachers", "Un spațiu pentru profesori"],
  "entry.teacherCopy": [
    "Create something that fits your class. Share it in moments.",
    "Creează activități potrivite clasei tale. Distribuie-le în câteva clipe.",
  ],
  "dashboard.eyebrow": ["YOUR TEACHING SPACE", "SPAȚIUL TĂU DE ÎNVĂȚARE"],
  "dashboard.subtitle": [
    "A clear space to prepare, share, and see their progress.",
    "Un loc simplu pentru pregătire, distribuire și urmărirea progresului.",
  ],
  "library.subtitle": [
    "Little activities. Meaningful progress.",
    "Activități mici. Progres important.",
  ],
  "library.search": ["Search worksheets", "Caută fișe de lucru"],
  "library.sort": ["Sort worksheets", "Sortează fișele"],
  "library.recent": ["Recently updated", "Actualizate recent"],
  "library.name": ["Name A–Z", "Nume A–Z"],
  "common.noMatches": [
    "No matches. Try a different search.",
    "Niciun rezultat. Încearcă altă căutare.",
  ],
  "common.search": ["Search", "Caută"],
  "common.settings": ["Settings", "Setări"],
  "common.preview": ["Preview", "Previzualizare"],
  "common.close": ["Close", "Închide"],
  "common.learn": ["Learn by doing", "Învață prin joacă"],
  "common.notFound": ["This page wandered off", "Această pagină s-a rătăcit"],
  "common.notFoundCopy": [
    "Let's get you back to a familiar place.",
    "Hai să revenim într-un loc cunoscut.",
  ],
  "common.backHome": ["Back to home", "Înapoi la început"],
  "editor.settings": ["Activity settings", "Setările activității"],
  "editor.preview": ["Child preview", "Previzualizare pentru elev"],
  "editor.previewNote": [
    "Try it here. Preview answers are never saved.",
    "Încearcă aici. Răspunsurile din previzualizare nu se salvează.",
  ],
  "editor.previewComplete": [
    "You completed all activities!",
    "Ai terminat toate activitățile!",
  ],
  Activity: ["Activity", "Activitatea"],
  "Leave without saving": ["Leave without saving", "Ieși fără salvare"],
  Name: ["Name", "Nume"],
  "Add pair": ["Add pair", "Adaugă pereche"],
  "Remove pair": ["Remove pair", "Elimină perechea"],
  Emoji: ["Picture or emoji", "Imagine sau emoji"],
  Number: ["Number", "Număr"],
  "Show password": ["Show password", "Arată parola"],
  "Hide password": ["Hide password", "Ascunde parola"],
  "Assign worksheet": ["Assign worksheet", "Atribuie fișa"],
  "Whole class": ["Whole class", "Întreaga clasă"],
  Assign: ["Assign", "Atribuie"],
  Class: ["Class", "Clasă"],
  "editor.saved": ["Saved", "Salvat"],
  "editor.unsaved": ["Unsaved changes", "Modificări nesalvate"],
  "editor.failed": [
    "Save failed · your changes are still here",
    "Salvarea a eșuat · modificările sunt păstrate",
  ],
  "editor.savedNotice": [
    "Worksheet saved successfully.",
    "Fișa de lucru a fost salvată cu succes.",
  ],
  "editor.restore": [
    "You have an unfinished draft",
    "Ai o versiune neterminată",
  ],
  "editor.restoreCopy": [
    "Restore your changes or continue with the saved version.",
    "Restabilește modificările sau continuă cu versiunea salvată.",
  ],
  "editor.conflict": [
    "The saved worksheet has changed",
    "Fișa salvată a fost modificată",
  ],
  "editor.conflictCopy": [
    "Keep the saved version, or recover your changes as a separate worksheet.",
    "Păstrează versiunea salvată sau recuperează modificările într-o fișă separată.",
  ],
  "editor.restoreAction": ["Restore draft", "Restabilește versiunea"],
  "editor.discard": ["Use saved version", "Folosește versiunea salvată"],
  "editor.recoverCopy": [
    "Recover as new worksheet",
    "Recuperează într-o fișă nouă",
  ],
  "editor.recoveryUnavailable": [
    "Browser recovery is unavailable. You can still save your worksheet.",
    "Recuperarea în browser nu este disponibilă. Poți salva în continuare fișa.",
  ],
  "editor.saveContinue": ["Save and continue", "Salvează și continuă"],
  "editor.saveFirst": [
    "Save your changes first",
    "Salvează mai întâi modificările",
  ],
  "editor.saveFirstCopy": [
    "Sharing and assigning use the saved worksheet.",
    "Distribuirea și atribuirea folosesc fișa salvată.",
  ],
  "editor.empty": [
    "Make room for a discovery",
    "Pregătește o nouă descoperire",
  ],
  "editor.emptyCopy": [
    "Add an activity, make it your own, then try it as a child.",
    "Adaugă o activitate, personalizeaz-o și încearc-o ca elev.",
  ],
  "editor.unavailable": [
    "This activity is unavailable. Its saved content is preserved.",
    "Această activitate nu este disponibilă. Conținutul salvat este păstrat.",
  ],
  "catalog.numbers": ["Numbers", "Numere"],
  "catalog.letters": ["Letters", "Litere"],
  "game.letters": ["Letters & pictures", "Litere și imagini"],
  "game.math": ["Easy math", "Matematică simplă"],
  "game.sequence": ["Number sequence", "Șir de numere"],
  "game.comparison": ["Higher or lower", "Mai mare sau mai mic"],
  "game.parity": ["Odd or even", "Par sau impar"],
  "game.matching": ["Match the Amounts", "Potrivește cantitățile"],
  "game.mathHelp": [
    "Tap the answer that completes the sum.",
    "Atinge răspunsul care completează calculul.",
  ],
  "game.sequenceHelp": [
    "Look at the steps. Which number comes next?",
    "Privește pașii. Ce număr urmează?",
  ],
  "game.comparisonHelp": [
    "Compare the two numbers. Is the first higher or lower?",
    "Compară numerele. Primul este mai mare sau mai mic?",
  ],
  "game.parityHelp": [
    "Can you share the number into two equal groups?",
    "Poți împărți numărul în două grupe egale?",
  ],
  "game.lettersHelp": [
    "Tap the letters that match the one shown above.",
    "Atinge literele care se potrivesc cu litera de mai sus.",
  ],
  "game.matchingHelp": [
    "Tap a number, then its group. Tap it again to move it back.",
    "Atinge un număr, apoi grupa lui. Atinge-l din nou pentru a-l muta înapoi.",
  ],
  "game.how": ["How to play", "Cum se joacă"],
  "game.correct": ["That's it!", "Corect!"],
  "game.incorrect": [
    "Keep going. You're learning.",
    "Continuă. Înveți cu fiecare pas.",
  ],
  "game.ready": [
    "Ready for the next discovery?",
    "Ești gata pentru următoarea descoperire?",
  ],
  "game.completed": [
    "A little practice, a big well done.",
    "Puțin exercițiu, un mare bravo.",
  ],
  "game.example": [
    "An example · not part of your score",
    "Un exemplu · nu influențează scorul",
  ],
  "preferences.sound": ["Game sounds", "Sunetele jocului"],
  "preferences.motion": ["Gentle motion", "Animații discrete"],
  "preferences.title": ["Make yourself comfortable", "Alege cum îți place"],
  "preferences.copy": [
    "These choices are saved on this device.",
    "Aceste opțiuni sunt salvate pe acest dispozitiv.",
  ],
  "report.activities": ["Activities", "Activități"],
  "class.present": ["Present code", "Afișează codul"],
  "class.presentCopy": [
    "Each child uses their own code and this worksheet code.",
    "Fiecare copil folosește codul personal și acest cod al fișei.",
  ],
  "auth.password": [
    "Use between 15 and 128 characters.",
    "Folosește între 15 și 128 de caractere.",
  ],
  "photo.description": [
    "Choose a photo or keep the original picture.",
    "Alege o fotografie sau păstrează imaginea originală.",
  ],
  "photo.next": ["Next", "Următoarea"],
  "photo.previous": ["Previous", "Anterioara"],
};
export function translator(language: Language): Translate {
  return (key, values = {}) => {
    const value = copy[key]?.[language === "ro" ? 1 : 0];
    return value
      ? value.replace(/\{(\w+)\}/g, (match, name: string) =>
          values[name] == null ? match : String(values[name]),
        )
      : translate(language, key, values);
  };
}
