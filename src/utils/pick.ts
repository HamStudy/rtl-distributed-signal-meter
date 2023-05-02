export function pick<T extends object, K extends keyof T>(objIn: T, fields: K[] | Set<K> | readonly K[]) : Pick<T, K>;
export function pick<T extends object, K extends keyof T>(objIn: T, ...fields: K[]) : Pick<T, K>;
export function pick<T extends object, K extends keyof T>(objIn: T, ...args: any[]) : Pick<T, K> {
    const fields: K[] | Set<K> | readonly K[] = Array.isArray(args[0]) ? args[0] : args;
    let objOut: Pick<T, K> = {} as any;

    for (let f of fields) {
        objOut[f] = objIn[f];
    }
    return objOut;
}

export default pick;
