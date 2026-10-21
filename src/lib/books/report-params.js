// Report filters from the URL, with safe defaults (shared by report pages and their CSV downloads).
// Relative imports on purpose so `node --test` can load this file directly.
import { addMonths, validDate } from "./expenses.js";
import { todayInIndia } from "../format.js";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function reportParams(search = {}, now = new Date()) {
  const today = todayInIndia(now);
  const month = today.slice(0, 7);
  const firstOfMonth = `${month}-01`;
  let from = validDate(search.from) ? search.from : firstOfMonth;
  let to = validDate(search.to) ? search.to : today;
  if (from > to) [from, to] = [to, from];
  let toMonth = MONTH.test(search.toMonth ?? "") ? search.toMonth : month;
  let fromMonth = MONTH.test(search.fromMonth ?? "") ? search.fromMonth : addMonths(`${toMonth}-01`, -5).slice(0, 7);
  if (fromMonth > toMonth) [fromMonth, toMonth] = [toMonth, fromMonth];
  const asOf = validDate(search.asOf) && search.asOf <= today ? search.asOf : today;
  const caMonth = MONTH.test(search.month ?? "") && search.month <= month ? search.month : addMonths(firstOfMonth, -1).slice(0, 7);
  return { today, from, to, fromMonth, toMonth, asOf, caMonth };
}
