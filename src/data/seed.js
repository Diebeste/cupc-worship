/** Curated songs and services from the team’s example documents (not invented). */

import { novemberServices, applyNovemberMerge, SEED_MEMBERS, SEED_SCHEDULE_META, normalizeService } from './roles.js'

const s = (type, label, linesEs = [], linesEn = [], notes = '') => ({
  type,
  label,
  notes,
  linesEs,
  linesEn
})

const L = (...lines) => lines

export const SEED_SONGS = [
  {
    id: 'song-cristo-yo-te-amo',
    title: 'Cristo yo te amo',
    artist: '',
    originalKey: 'F',
    bpm: '',
    notes: 'From the 15/11 service document.',
    sections: [
      s('verse', '', L(
        'Cristo, yo te amo',
        'Cristo, yo te amo',
        'No hay nadie como Tú',
        'Jesús',
        '',
        'Y no sé dónde estuviera',
        'Si yo a Ti no te tuviera',
        'Si no hubiera conocido',
        'Al Dios que me ama'
      ), L(
        'Jesus how I love you',
        'Jesus how I love you',
        'No one compares to you, Jesus',
        '',
        "I can't imagine being without you",
        'I would be so lost without you',
        'Weak and broken yet you love you',
        'Oh Lord and my King'
      ))
    ]
  },
  {
    id: 'song-entra-en-la-presencia',
    title: 'Entra en la presencia',
    artist: '',
    originalKey: 'G',
    bpm: '',
    notes: 'From the 15/11 service document.',
    sections: [
      s('verse', '', L(
        'Entra en la presencia del Señor con gratitud',
        'Y adórale de corazón',
        '',
        'Entra en la presencia del Señor con gratitud',
        'Y alza tu voz, con júbilo',
        '',
        'Da gloria y honra y alabanzas al Señor',
        'Jesu Cristo nombre sin igual',
        '',
        'Da gloria y honra y alabanzas al Señor',
        '¡Jesu Cristo! nombre sin igual',
        '',
        'Nombre sin igual',
        'Nombre sin igual'
      ), L(
        'Come into His presence',
        'With thanksgiving in your heart',
        'And give Him praise',
        'And give Him praise',
        '',
        'Come into His presence',
        'With thanksgiving in your heart',
        'Your voices raise',
        'Your voices raise',
        '',
        'Give glory and honor and power unto Him',
        'Jesus the name above all names'
      ))
    ]
  },
  {
    id: 'song-dios-imparable',
    title: 'Dios imparable',
    artist: '',
    originalKey: 'F',
    bpm: '',
    notes: 'From the 15/11 service document. Spanish lyrics only in the source.',
    sections: [
      s('verse', '', L(
        'Eres alabado, eres exaltado',
        'Tu nombre levantamos, aleluya, aleluya',
        'Eres adorado te glorificamos',
        'Tu nombre levantamos, aleluya, aleluya',
        '',
        'A una sola voz, nos unimos hoy',
        'Te cantamos Dios en adoración'
      ), []),
      s('chorus', 'Chorus', L(
        'Dios imparable, Dios de imposibles',
        'Inigualable, eres invencible',
        'Dios imparable, Dios de imposibles',
        'Inigualable, eres invencible'
      ), []),
      s('verse', 'Verse', L(
        'No tengo temor en mi corazón, tú tienes el control',
        'No tengo temor en mi corazón, tú tienes el control'
      ), []),
      s('bridge', 'Bridge', L(
        'No me falta nada si te tengo a ti',
        'No me falta nada si te tengo a ti',
        '',
        'Y yo sé quien va conmigo va por mí',
        'Y quien a mis enemigos hace huir',
        'No me falta nada si te tengo a ti',
        'Y no me falta nada, porque te tengo a ti'
      ), [])
    ]
  },
  {
    id: 'song-mas-de-ti',
    title: 'Más de ti',
    artist: '',
    originalKey: 'F',
    bpm: '',
    notes: 'From the 15/11 service document. Source listed the key as FA.',
    sections: [
      s('verse', 'Verse', L(
        'Me postro ante tu altar',
        'Yo vine para adorar',
        'Mi todo entrego hoy',
        'Tu gloria quiero ver',
        '',
        'Ven sacia hoy mi vida',
        'y lléname otra vez.',
        'Me postro ante tu altar',
        'Yo vine para adorar',
        '',
        'Mi todo entrego hoy',
        'Tu gloria quiero ver',
        'Satura hoy mi vida y',
        'lléname otra vez.'
      ), L(
        'I come before you Lord, today',
        "I've to come to praise your holy name",
        '',
        'I give myself to You',
        'Your glory I want to see',
        'Come into my life and fill me once again'
      )),
      s('chorus', 'Chorus', L(
        'Más de ti',
        'Es todo lo que anhelo, es todo lo que anhelo',
        'Más de ti',
        'Es lo que necesito, es lo que necesito'
      ), L(
        'More of You is all that I desire,',
        'Is all that I desire',
        '',
        "More of You is all I've ever needed,",
        "Is all I've ever needed"
      )),
      s('bridge', 'Bridge', [], L(
        'I give all I have to You Lord',
        'Your glory I want to see, Your glory I want to see',
        '',
        'I come before You Lord today',
        'Satisfy my life, fill me once again'
      ))
    ]
  },
  {
    id: 'song-i-give-you-glory',
    title: 'I give you glory',
    artist: '',
    originalKey: '',
    bpm: '',
    notes: 'From the 15/11 service document. No key was listed in the source.',
    sections: [
      s('verse', '', L(
        'Cuan hermoso, eres Jesús',
        'Son tus palabras, es tu amor',
        '',
        'Cuan glorioso, eres Jesús',
        'Es tu poder, fue tu cruz',
        'La que me salvó, me rescató',
        'Un momento ahí, nos dio libertad'
      ), L(
        'Oh, how beautiful',
        'Are You, Lord',
        "It's Your words",
        "It's Your love",
        '',
        'Oh, how glorious',
        'Are You, Lord',
        "It's Your power",
        'It was Your cross',
        '',
        'That saved me',
        'And rescued me',
        'Just a moment there'
      )),
      s('chorus', 'Chorus', L(
        'Te doy gloria, gloria',
        'Te doy gloria, gloria',
        'Te doy gloria, gloria',
        'A ti Jesús...'
      ), L(
        'I give You glory, glory',
        'I give You glory, glory',
        'I give You glory, glory',
        'Jesus'
      )),
      s('verse', 'Verse', L(
        'Con una corona de espinos',
        'Te hiciste mi rey por siempre'
      ), L(
        'With a crown of thorns',
        'You became my King forever'
      ))
    ]
  },
  {
    id: 'song-al-estar-ante-ti',
    title: 'Al estar ante ti',
    artist: '',
    originalKey: 'C',
    bpm: '',
    notes: 'From Semana de alabanza — Jueves Acústico. Listed in the setlist table as “Al estar en ti”. The same packet also has these lyrics in D.',
    sections: [
      s('verse', 'Verse', L(
        'Al estar ante tí adorando frente al mar de cristal',
        'entre la multitud en asombro allí me habré de postrar.',
        '',
        'Y mi canto uniré a millones proclamándote Rey',
        'y mi voz oirás entre las multitudes cantar te.'
      ), [], 'Wilfredo'),
      s('chorus', 'Chorus', L(
        'Digno es el cordero de Dios',
        'el que fue inmolado-en la cruz',
        'digno de la honra y el poder',
        'la sabiduría suya es.',
        '',
        'Y al que está en el trono sea el honor',
        'santo santo santo es el Señor',
        'reina por los siglos con poder',
        'todo lo que existe es por El'
      ), [], 'unísono'),
      s('verse', 'Verse', L(
        'Al estar ante tí adorando frente al mar de cristal',
        'entre la multitud en asombro allí me habré de postrar.',
        '',
        'Y mi canto uniré a millones proclamándote Rey',
        'y mi voz oirás entre las multitudes cantar'
      ), [], 'unísono'),
      s('chorus', 'Chorus', L(
        'Digno es el cordero de Dios',
        'el que fue inmolado-en la cruz',
        'digno de la honra y el poder',
        'Y la sabiduría suya es.',
        '',
        'Y al que está en el trono sea el honor',
        'santo santo santo es el Señor',
        'reina por los siglos con poder',
        'todo lo que existe es por El'
      ), [], 'armonías (Wilfredo, Brandon, Kathy)'),
      s('tag', 'Unaccompanied', L(
        'Y al que está en el trono sea el honor',
        'santo santo santo es el Señor',
        'reina por los siglos con poder',
        'todo lo que existe es por El…',
        'todo lo que existe es por El (para terminar)'
      ), [], 'SIN INSTRUMENTOS')
    ]
  },
  {
    id: 'song-por-el-poder-de-tu-amor',
    title: 'Por el poder de tu amor',
    artist: '',
    originalKey: 'G',
    bpm: '',
    notes: 'From Semana de alabanza — Jueves Acústico. English and Spanish verses from the event packet; the tag was sung after the song that Thursday.',
    sections: [
      s('verse', 'Verse 1', L(
        'Vengo a Ti, Señor',
        'Cámbiame, renuévame',
        'Por la gracia que',
        'Encontré en Ti',
        '',
        'Ahora sé que las',
        'Debilidades que hay en mí',
        'Desvanecerán',
        'Por el poder de Tu amor'
      ), L(
        "Lord, I've come to you",
        'Let my heart be changed, renewed',
        "Following from the grace that I've found in you",
        '',
        "Lord, I've come to know",
        "The weaknesses I've seen in me",
        'Will be stripped away',
        'By the power of your love'
      ), 'Kathy (EN, Jueves Acústico)'),
      s('chorus', 'Chorus', L(
        'Cúbreme',
        'Con Tu amor, rodéame',
        'Tómame',
        'Cerca quiero estar',
        '',
        'Y, al esperar',
        'Nuevas fuerzas, yo tendré',
        'Y me levantaré',
        'Como las águilas',
        'Por el poder de Tu amor'
      ), L(
        'And hold me close',
        'Let your love surround me',
        'Bring me near',
        'Draw me to your side',
        '',
        'And as I wait',
        "I'll rise up like the eagles",
        'And I will soar with you',
        'Your spirit leads me on',
        'By the power of your love'
      ), 'armonías, Juan, Brandon, Kathy (ES, Jueves Acústico)'),
      s('verse', 'Verse 2', L(
        'Yo Te quiero ver',
        'Cara a cara, oh, Señor',
        'Y conocer, así, más de Ti',
        'En mí',
        '',
        'Prepárame, Señor',
        'Para hacer Tu voluntad',
        'Viviendo cada día',
        'Por el poder de Tu amor'
      ), L(
        'So Lord unveiled my eyes',
        'Let me see you face to face',
        'The knowledge of your love',
        'As you live in me',
        '',
        'Lord, renew my mind',
        'As your will unfolds in my life',
        'And living every day',
        'By the power of your love'
      ), 'Alejandra & unísono (ES, Jueves Acústico)'),
      s('tag', 'Tag', L(
        'Cante al Señor toda la creación',
        'Honra y poder, majestad, sea al Rey',
        'Montes caerán y el mar rugirá',
        'Al sonar de su nombre',
        '',
        'Canto con gozo al mirar tu poder',
        'Por siempre, yo te amaré y diré',
        'Incomparables promesas me das',
        '',
        'Incomparables promesas me das',
        'Incomparables promesas me das',
        'Señor'
      ), [], 'Armonías Brandon, Wilfredo (Jueves Acústico)')
    ]
  },
  {
    id: 'song-at-your-feet',
    title: 'At your feet / A tus pies',
    artist: '',
    originalKey: 'G#',
    bpm: '',
    notes: 'From Semana de alabanza — Jueves Acústico.',
    sections: [
      s('verse', 'Verse 1', L(
        'A Tus pies, arde mi corazón',
        'A Tus pies, entrego lo que soy',
        'Ese lugar de mi seguridad',
        'Donde nadie me puede señalar'
      ), L(
        "At your feet, that's where",
        'I want to be',
        'At your feet',
        'I surrender who I am',
        "It's in this place I find security",
        'Where nobody can do me any harm'
      )),
      s('prechorus', 'Pre-Chorus', L(
        'Me perdonaste',
        'Me acercaste a Tu presencia',
        'Me levantaste',
        'Hoy me postro a adorarte'
      ), L(
        'You have forgiven me',
        'And brought me closer to',
        'Your presence',
        'You have lifted me',
        'and now I bow down',
        'to worship'
      )),
      s('chorus', 'Chorus', L(
        'No hay lugar más alto, más grande',
        'Que estar a Tus pies, que estar a Tus pies',
        'No hay lugar más alto, más grande',
        'Que estar a Tus pies, que estar a Tus pies'
      ), L(
        "There is no place that's higher",
        "That's greater",
        'Than to be at Your feet',
        'To be at Your feet'
      )),
      s('bridge', 'Bridge', L(
        'Y aquí permaneceré',
        'Postrado a Tus pies',
        'Y aquí permaneceré',
        'A los pies de Cristo'
      ), L(
        'And right here I will remain',
        'Kneeling at Your feet',
        'And right here I will remain',
        'At the feet of Jesus'
      ))
    ]
  },
  {
    id: 'song-solo-a-ti-sea-la-gloria',
    title: 'Solo a ti sea la gloria',
    artist: '',
    originalKey: 'C',
    bpm: '',
    notes: 'From Semana de alabanza — Jueves Acústico. English chorus as written in the source.',
    sections: [
      s('verse', 'Verse', L(
        'No existen más motivos Señor',
        'venimos hoy rendidos a Ti',
        'la única razón de nuestra adoración',
        'hoy eres tu',
        'elevamos olor fragante para ti,',
        'para ti.'
      ), [], 'Wilfredo'),
      s('chorus', 'Chorus', L(
        'Solo a Ti sea la gloria …Señor',
        'la alabanza y la adoración',
        'toda rodilla se doble',
        'ante el único Rey y Dios',
        '',
        'Solo a Ti sea la gloria …Señor',
        'la alabanza y la adoración',
        'que toda lengua confiese',
        'que tu eres el Señor.'
      ), L(
        'Only you deserve the glory … and praise',
        'All of your worship our hearts will sing',
        'And every tongue will confess',
        'That You are almighty God'
      ), 'unísono')
    ]
  },
  {
    id: 'song-dios-rompio-cadenas',
    title: 'Dios rompió cadenas',
    artist: '',
    originalKey: 'F',
    bpm: '',
    notes: 'From Semana de alabanza — Jueves Acústico. Spanish lyrics only in the source. A later page in the same packet writes the chorus as “Dios cortó cadenas”.',
    sections: [
      s('verse', 'Verse 1', L(
        'Si me preguntas porque alabo el nombre de Jesús',
        'Tengo que contarte la verdad de mi existir',
        'Cuando mis amigos se marcharon toda dirección',
        'Cuando oscuramente veía mi porvenir',
        '',
        'Sin esperanzas caminaba en un sendero gris',
        'Todo aquel infierno quería adueñarse más de mí',
        'Una gota de sangre y de misericordia entró en mi ser',
        'Me dijo Jesús yo te haré vencer te levantaré'
      ), [], 'Daniel'),
      s('chorus', 'Chorus', L(
        'Dios rompió cadenas de tormento',
        'De dolor de sufrimiento en aquel madero ensangrentado',
        'Se llevó las penas de mi triste y cruel pasado',
        'Y me dio la libertad',
        'por eso le alabo',
        '',
        'Hoy mi risa, mi canto, mi lloro, mis manos',
        'Mi todo tienen un nuevo nombre:',
        '¡Jesús!',
        '',
        'Levantaré mi voz para que puedan escuchar',
        'Que eres tú Jesús Señor de señores',
        'Como no alabarle…'
      ), [], 'Todos'),
      s('verse', 'Verse 2', L(
        'Si me preguntas porque alabo el nombre de Jesús',
        'Tengo que contarte la verdad de mi existir',
        'Este hombre que canta no valía un peso, que puedo decir',
        'Cristo me compró, me hizo impagable',
        'Cómo no alabarle…',
        '',
        'Sin esperanzas caminaba en un sendero gris',
        'Todo aquel infierno quería adueñarse más de mí',
        'Una gota de sangre y de misericordia entró en mi ser',
        'Me dijo Jesús yo te haré vencer, te levantaré'
      ), [], 'Wilfredo (last line: todos)')
    ]
  },
  {
    id: 'song-believe-for-it',
    title: 'Believe for it',
    artist: '',
    originalKey: '',
    bpm: '',
    notes: 'Included in the Semana de alabanza packet. No key was listed in the source.',
    sections: [
      s('verse', 'Verse 1', L(
        'No creen que montes moverás',
        'Ni que cadenas romperás',
        'Mas sé lo que puedes hacer',
        'En Tu nombre hay poder',
        '',
        'Dicen que este es el final',
        'Que la tormenta seguirá',
        'No han visto lo que hace la fe',
        'En Tu nombre hay poder',
        'En Tu nombre hay poder'
      ), L(
        "They say this mountain can't be moved",
        'They say these chains will never break',
        "But they don't know You like we do",
        'There is power in Your name',
        '',
        "We've heard that there is no way through",
        "We've heard the tide will never change",
        "They haven't seen what You can do",
        'There is power in Your name',
        'So much power in Your name'
      )),
      s('chorus', 'Chorus', L(
        'Montañas moverás',
        'Cadenas romperás',
        'Creemos que',
        'Creemos que lo harás',
        'Lo que imposible es',
        'Tú lo puedes hacer',
        'Creemos que',
        'Creemos que lo harás'
      ), L(
        'Move the immovable',
        'Break the unbreakable',
        'God we believe',
        'God we believe for it',
        '',
        'From the impossible',
        "We'll see a miracle",
        'God we believe',
        'God we believe for it'
      )),
      s('verse', 'Verse 2', L(
        'Nuestra esperanza eterna es',
        'La muerte derrotada fue',
        'Sin ver podemos aun creer',
        'En Tu nombre hay poder',
        'En Tu nombre hay poder'
      ), L(
        'We know that hope is never lost (Oh)',
        'For there is still an empty grave',
        'God we believe no matter what',
        'There is power in Your name',
        'So much power in Your name'
      )),
      s('bridge', 'Bridge', L(
        'Abres camino en donde no lo hay',
        'En Ti confiamos, Dios, en Tú voluntad',
        '',
        'Tú lo dices',
        'Yo lo creo',
        'Tú lo dices',
        'Hecho está'
      ), L(
        'You are the way',
        'When there seems to be no way',
        'We trust in You',
        'God You have the final say',
        '',
        'You said it',
        'I believe it',
        'You said it',
        'It is done'
      ))
    ]
  },
  {
    id: 'song-hermoso-momento',
    title: 'Hermoso momento',
    artist: '',
    originalKey: '',
    bpm: '',
    notes: 'Included in the Semana de alabanza packet. Spanish lyrics only; no key was listed in the source.',
    sections: [
      s('verse', '', L(
        'Qué hermoso es cada momento',
        'Que me visitas y de mí haces un altar',
        'Quiero me lleves más adentro',
        'Toma mi mano, no la sueltes nunca más',
        '',
        'Llévame a un lugar',
        'Donde solos, Tú y yo',
        'Disfrutemos el momento',
        'Te amo, mi Papá, ah, ah-ah',
        'Yo dependo de tu amor',
        'Y sin Ti, yo sé que muero',
        'Que muero',
        'Oh, yo muero sin Ti, Dios',
        '',
        'Tú me viste en mi tormenta',
        'Me libraste de la prueba',
        'Te llevaste mi tristeza',
        'Me cambió la vida entera',
        'Me vistió con ropas nuevas',
        'Puso aceite en mi cabeza',
        'Me hizo un lugar en su mesa',
        'Como un padre me desea'
      ), [])
    ]
  }
]

export const SEED_SERVICES = [
  {
    id: 'service-15-11',
    name: '15/11',
    date: '2026-11-15',
    type: 'sunday',
    leader: 'BRANDON',
    subtitle: 'CULTO GENERAL',
    voices: ['Kathy', 'Anamaria'],
    instruments: [
      { name: 'Piano', player: 'Daniel' },
      { name: 'Bass', player: '' },
      { name: 'Drums', player: 'Juan' }
    ],
    ujier: '',
    notes: 'Typical service setlist from the team’s “15/11” document. Date taken as 15 November 2026 from the file title (year not printed on the pages). Roles from the November 2026 schedule sheet.',
    items: [
      { songId: 'song-cristo-yo-te-amo', key: 'F', lead: '', notes: '' },
      { songId: 'song-entra-en-la-presencia', key: 'G', lead: '', notes: '' },
      { songId: 'song-dios-imparable', key: 'F', lead: '', notes: '' },
      { songId: 'song-mas-de-ti', key: 'F', lead: '', notes: '' },
      { songId: 'song-i-give-you-glory', key: '', lead: '', notes: 'No key listed in the source document.' }
    ]
  },
  {
    id: 'service-semana-jueves',
    name: 'Semana de alabanza — Jueves Acústico',
    date: '2026-11-19',
    type: 'event',
    subtitle: 'SEMANA DE ALABANZA',
    leader: 'WILFREDO',
    voices: ['Kathy', 'Alejandra', 'Brandon', 'Anamaria'],
    instruments: [
      { name: 'Piano', player: 'Daniel' },
      { name: 'Bass', player: '' },
      { name: 'Drums', player: 'Juan' }
    ],
    ujier: '',
    notes: 'Special event setlist from the “Semana de alabanza Jueves” document, dated Thursday 19 November 2026 from the November schedule sheet. Leads and harmony notes are on the song pages.',
    items: [
      { songId: 'song-al-estar-ante-ti', key: 'C', lead: 'Wilfredo', notes: 'COMIENZO' },
      { songId: 'song-por-el-poder-de-tu-amor', key: 'G', lead: 'Kathy', notes: '' },
      { songId: 'song-at-your-feet', key: 'G#', lead: '', notes: '' },
      { songId: 'song-solo-a-ti-sea-la-gloria', key: 'C', lead: 'Wilfredo', notes: '' },
      { songId: 'song-dios-rompio-cadenas', key: 'F', lead: 'Daniel', notes: '' }
    ]
  }
]

export function stampedSeed() {
  const ts = '2026-11-15T00:00:00.000Z'
  const core = SEED_SERVICES.map((s) => applyNovemberMerge({ ...s, createdAt: ts, updatedAt: ts, seeded: true }))
  const extras = novemberServices().map((s) => ({ ...normalizeService(s), createdAt: ts, updatedAt: ts, seeded: true }))
  return {
    songs: SEED_SONGS.map((s) => ({ ...s, createdAt: ts, updatedAt: ts, seeded: true })),
    services: [...core, ...extras],
    members: SEED_MEMBERS.map((m) => ({ ...m })),
    scheduleMeta: { ...SEED_SCHEDULE_META }
  }
}
