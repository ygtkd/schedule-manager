export const dateKey = date => [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
export function jstDay(iso) {
 return new Date(Date.parse(iso)+9*3600000).toISOString().slice(0,10);
}
export function onDay(event, day) {
 const endExclusive = day + 'T00:00:00+09:00';
 const next = new Date(Date.parse(endExclusive)+86400000).toISOString();
 if(event.start.date) return event.start.date <= day && event.end.date > day;
 return Date.parse(event.start.dateTime) < Date.parse(next) && Date.parse(event.end.dateTime) > Date.parse(endExclusive);
}
export function eventTime(event) {
 if(event.start.date) return '終日';
 const fmt = new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hour12:false});
 return fmt.format(new Date(event.start.dateTime))+' — '+fmt.format(new Date(event.end.dateTime));
}
