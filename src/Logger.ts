export interface ILogger {
    log(msg: string): void;
}

export class Logger implements ILogger {
    log(msg: string): void {
        console.log(msg);
    }
}

export class NoLogger implements ILogger {
    log(msg: string): void {}
}