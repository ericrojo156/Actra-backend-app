import { TimeObjectAPI } from "../api/ActraAPI";

export enum TimeFormat {
    HMS, MS, S
}
export class InvalidTimeUnitRequest extends Error {
    constructor(requestedTimeUnit: string, formatStr: string) {
        super(`${requestedTimeUnit} is not a valid time unit request for TimeObject formatted as ${formatStr}`);
    }
}
export class TimeObject {
    private readonly seconds: number;
    private readonly mins: number;
    private readonly hours: number;
    readonly formatStr: string;
    constructor(seconds: number = Date.now() / 1000,  format: TimeFormat = TimeFormat.HMS) {
        this.seconds = seconds;
        this.mins = 0;
        this.hours = 0;
        this.formatStr = TimeFormat[format];
        if (this.isMinsFormatted()) {
            if (this.isHoursFormatted()) {
                this.hours = Math.floor((this.seconds / 60) / 60);
                this.mins = Math.floor((seconds / 60) - (this.hours * 60));
                this.seconds = Math.floor(seconds - (this.mins * 60) - (this.hours * 60 * 60));
            } else {
                this.mins = Math.floor(this.seconds / 60);
                this.seconds = Math.floor(this.seconds - (this.mins * 60));
            }
        }
    }
    isMinsFormatted(): boolean {
        return this.formatStr.includes("M");
    }
    isHoursFormatted(): boolean {
        return this.formatStr.includes("H");
    }
    getHours(): number {
        if (!this.formatStr.includes("H")) {
            throw new InvalidTimeUnitRequest("Hours", this.formatStr);
        }
        return this.hours;
    }
    getMins(): number {
        if (!this.formatStr.includes("M")) {
            throw new InvalidTimeUnitRequest("M", this.formatStr);
        }
        return this.mins;
    }
    getSeconds(): number {
        return this.seconds;
    }
    getTotalSeconds(): number {
        let totalSeconds: number = this.seconds;
        if (this.isMinsFormatted()) {
            totalSeconds += this.mins * 60;
        }
        if (this.isHoursFormatted()) {
            totalSeconds += this.hours * 60 * 60;
        }
        return totalSeconds;
    }
    static sanitizeNumericValue(value: any): number {
        let isValid: boolean = value > 0 && !Number.isNaN(Number.parseFloat(value));
        return isValid ? value : 0;
    }
    static addMultiple(...timeObjects: TimeObject[]) {
        return timeObjects.reduce((acc: TimeObject, curr: TimeObject) => {
            return TimeObject.add(acc, curr);
        });
    }
    static add(o1: TimeObject, o2: TimeObject, format: TimeFormat = TimeFormat.HMS): TimeObject {
        let totalSeconds: number = o1.getTotalSeconds() + o2.getTotalSeconds();
        return new TimeObject(totalSeconds, format);
    }
    static fromObject(obj: Object, format: TimeFormat = TimeFormat.HMS): TimeObject {
        if (typeof(obj) === 'object') {
            let seconds: number = TimeObject.sanitizeNumericValue(obj['seconds']);
            let mins: number = TimeObject.sanitizeNumericValue(obj['mins']);
            let hours: number = TimeObject.sanitizeNumericValue(obj['hours']);
            return new TimeObject(seconds + (mins * 60) + (hours * 60 * 60), format);
        } else {
            console.log(`Object argument to TimeObject.fromObject() is of type ${typeof(obj)} instead of object, returning default TimeObject`);
            return new TimeObject();
        }
    }
    toObject(): TimeObjectAPI {
        return {
            seconds: this.seconds,
            mins: this.mins,
            hours: this.hours
        };
    }
}