import {TrackingState} from "./TrackingState";
import {TimeObject, TimeFormat} from "./TimeObject";
import {v4 as uuidv4} from "uuid";

export interface IntervalProps {
    startTimeSeconds: number,
    endTimeSeconds: number
}

export class TrackingInterval {
    id: uuidv4;
    startTimeSeconds: number;
    endTimeSeconds: number;
    state: TrackingState;
    constructor(startTimeSeconds: number, id: uuidv4 = null) {
        this.id = id || uuidv4();
        this.startTimeSeconds = startTimeSeconds;
        this.endTimeSeconds = null;
        this.state = TrackingState.ACTIVE;
    }
    getId(): uuidv4 {
        return this.id;
    }
    setEndTime(endTimeSeconds: number) {
        this.endTimeSeconds = endTimeSeconds;
        this.state = TrackingState.INACTIVE;
    }
    getTrackingState(): TrackingState {
        return this.state;
    }
    setTrackingState(state: TrackingState) {
        this.state = state;
    }
    toTimeObject(format: TimeFormat = TimeFormat.HMS): TimeObject {
        return new TimeObject(
            this.state === TrackingState.INACTIVE && this.endTimeSeconds !== null
                ? this.endTimeSeconds - this.startTimeSeconds 
                : (Date.now() / 1000) - this.startTimeSeconds,
            format
        );
    }
    setFields(payload: IntervalProps): TimeObject {
        if (typeof(payload.startTimeSeconds) !== 'undefined') {
            this.startTimeSeconds = payload.startTimeSeconds;
        }
        if (typeof(payload.endTimeSeconds) !== 'undefined') {
            this.endTimeSeconds = payload.endTimeSeconds;
        }
        return this.toTimeObject();
    }
    static fromObject(intervalObject: Object): TrackingInterval {
        let trackingInterval: TrackingInterval = new TrackingInterval(intervalObject['startTimeSeconds'], intervalObject['id']);
        trackingInterval.endTimeSeconds = intervalObject['endTimeSeconds'];
        trackingInterval.state = intervalObject['state'] === "ACTIVE" || intervalObject['state'] === 1 ? TrackingState.ACTIVE : TrackingState.INACTIVE;
        return trackingInterval;
    }
    equals(other: TrackingInterval): boolean {
        return this.startTimeSeconds === other.startTimeSeconds
            && this.endTimeSeconds === other.endTimeSeconds
            && this.state === other.state;
    }
    toObject(): Object {
        return {
            id: this.getId(),
            startTimeSeconds: this.startTimeSeconds,
            endTimeSeconds: this.endTimeSeconds,
            state: this.state === TrackingState.ACTIVE || this.state === 1 ? "ACTIVE" : "INACTIVE",
            duration: this.toTimeObject().toObject()
        };
    }
}