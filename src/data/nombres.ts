// Nombres para los habitantes del metro.
import type { Rng } from '../core/rng';

const MALE = ['Aleksei', 'Andrei', 'Anton', 'Artyom', 'Bogdan', 'Boris', 'Denis', 'Dmitri', 'Eduard', 'Fyodor', 'Gennadi', 'Gleb', 'Grigori', 'Igor', 'Ilya', 'Ivan', 'Kirill', 'Konstantin', 'Leonid', 'Maksim', 'Mikhail', 'Nikita', 'Nikolai', 'Oleg', 'Pavel', 'Pyotr', 'Roman', 'Ruslan', 'Semyon', 'Sergei', 'Stepan', 'Taras', 'Timofei', 'Vadim', 'Valeri', 'Vasili', 'Viktor', 'Vitali', 'Vladislav', 'Yaroslav', 'Yegor', 'Yuri', 'Zakhar'];
const FEMALE = ['Alina', 'Alla', 'Anastasia', 'Anna', 'Daria', 'Galina', 'Inna', 'Irina', 'Katya', 'Kira', 'Larisa', 'Lidia', 'Ludmila', 'Marina', 'Maria', 'Nadezhda', 'Natalia', 'Nina', 'Oksana', 'Olga', 'Polina', 'Raisa', 'Sasha', 'Sofia', 'Svetlana', 'Tamara', 'Tatiana', 'Valentina', 'Varvara', 'Vera', 'Yelena', 'Yulia', 'Zoya'];
const SURNAME = ['Abramov', 'Antonov', 'Baranov', 'Belov', 'Bogdanov', 'Chernov', 'Davydov', 'Dorokhov', 'Filatov', 'Gavrilov', 'Golubev', 'Gorbunov', 'Ignatov', 'Kalinin', 'Karpov', 'Kiselyov', 'Klimov', 'Komarov', 'Kotov', 'Krylov', 'Kulikov', 'Lazarev', 'Loginov', 'Makarov', 'Maslov', 'Medvedev', 'Melnikov', 'Nazarov', 'Nikitin', 'Osipov', 'Panov', 'Polyakov', 'Rodionov', 'Savin', 'Shubin', 'Sidorov', 'Sorokin', 'Subbotin', 'Tikhonov', 'Titov', 'Ushakov', 'Vinogradov', 'Vlasov', 'Yermakov', 'Zaitsev', 'Zhukov', 'Zimin'];
const CAL_MALE = ['Ahmed', 'Ali', 'Anvar', 'Bulat', 'Damir', 'Farid', 'Ibrahim', 'Ildar', 'Ismail', 'Kamil', 'Karim', 'Marat', 'Mansur', 'Murad', 'Nail', 'Rashid', 'Rinat', 'Rustam', 'Salman', 'Tahir', 'Tariq', 'Timur', 'Umar', 'Yusuf', 'Zaur'];
const CAL_FEMALE = ['Aisha', 'Alsu', 'Amina', 'Dilara', 'Fatima', 'Gulnara', 'Leila', 'Madina', 'Zarina', 'Zulfia'];
const CAL_SURNAME = ['Aliyev', 'Akhmedov', 'Galeev', 'Gataullin', 'Ibragimov', 'Ismailov', 'Karimov', 'Khasanov', 'Magomedov', 'Nurgaliev', 'Rakhimov', 'Safin', 'Umarov', 'Yusupov', 'Zakirov'];
const NICK = ['el Cojo', 'Tres Dedos', 'el Mudo', 'la Rata', 'el Largo', 'Sopa', 'el Gris', 'Chispa', 'el Zurdo', 'Tornillo', 'el Sordo', 'Hollín', 'el Flaco', 'Tuerca', 'la Sombra', 'Colmillo', 'el Viejo', 'Ceniza'];

export function randomName(rng: Rng, female: boolean, style: 'ruso' | 'califato' | 'bandido' = 'ruso'): string {
  if (style === 'califato') return `${rng.pick(female ? CAL_FEMALE : CAL_MALE)} ${rng.pick(CAL_SURNAME)}${female ? 'a' : ''}`;
  const first = rng.pick(female ? FEMALE : MALE);
  if (style === 'bandido' && rng.chance(0.6)) return `${first} «${rng.pick(NICK)}»`;
  const sur = rng.pick(SURNAME);
  return `${first} ${female ? sur + 'a' : sur}`;
}
