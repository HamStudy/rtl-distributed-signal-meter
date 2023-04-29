import Agenda from 'agenda';
import { getDatabase } from "./index";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

let agenda: Agenda;
export async function getAgenda() {
    const db = await getDatabase();
    agenda = new Agenda({mongo: db as any, processEvery: '10 seconds', defaultLockLifetime: 5000});
    
    agenda.start();
    return agenda;
}
export async function stopAgenda() {
    try {
        if (agenda) {
            await agenda.stop();
            console.log("Giving agenda a few seconds to shut down...");
            await delay(5000);
            await agenda.close();
        }
    } catch {
        // We basically don't care if it doesn't shut down fully
        try {
            await agenda.close();
        } catch {}
    }
}