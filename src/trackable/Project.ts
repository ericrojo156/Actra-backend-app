import { Activity } from "./Activity";
import {ITrackable} from "./ITrackable"
import {v4 as uuidv4} from "uuid";
import { TimeFormat, TimeObject } from "./TimeObject";
import { TrackingInterval } from "./TrackingInterval";
import { ITrackablesStore } from "../dataAccess/ITrackablesStore";
import { TrackingState } from "./TrackingState";
import { RGBColor } from "./RGBColor";

export class Project implements ITrackable {
    projectActivity: Activity;
    trackables: Set<uuidv4>;
    constructor(store: ITrackablesStore, name: string = "NoName", color: RGBColor = new RGBColor(), id: uuidv4 = uuidv4()) {
        this.projectActivity = new Activity(store, name, color, id);
        this.trackables = new Set();
    }
    deleteInterval(intervalId: number): void {
        this.projectActivity.deleteInterval(intervalId);
    }
    setName(name: string): void {
        this.projectActivity.setName(name);
    }
    setColor(color: RGBColor): void {
        this.projectActivity.setColor(color);
    }
    getTrackingState(): TrackingState {
        return this.projectActivity.getTrackingState();
    }
    getId() {
        return this.projectActivity.getId();
    }
    getStore(): ITrackablesStore {
        return this.projectActivity.getStore();
    }
    getName(): string {
        return this.projectActivity.getName();
    }
    getColor(): RGBColor {
        return this.projectActivity.getColor();
    }
    getTrackingInterval(id: number): TrackingInterval {
        return this.projectActivity.getTrackingInterval(id);
    }
    setIntervalTime(intervalId: number, timeObject: TimeObject): TrackingInterval {
        return this.projectActivity.setIntervalTime(intervalId, timeObject);
    }
    getCurrentInterval(): TrackingInterval {
        return this.projectActivity.getCurrentInterval();
    }
    setCurrentInterval(id: uuidv4): void {
        this.projectActivity.setCurrentInterval(id);
    }
    getTrackingHistory(): TrackingInterval[] {
        return this.projectActivity.getTrackingHistory();
    }
    getObservers(): Set<uuidv4> {
        return this.projectActivity.getObservers();
    }

    beginNewTrackingInterval(): number {
        return this.projectActivity.beginNewTrackingInterval();
    }

    finishTrackingInterval(): void {
        this.projectActivity.finishTrackingInterval();
    }

    startTracking(): number {
        return this.projectActivity.startTracking();
    }

    stopTracking(): void {
        this.projectActivity.stopTracking();
    }
    
    addIntervalToTrackingHistory(trackingInterval: TrackingInterval): void {
        this.projectActivity.addIntervalToTrackingHistory(trackingInterval);
    }

    addObserver(tracker: ITrackable): void {
        this.projectActivity.addObserver(tracker);
    }

    removeObserver(id: uuidv4): void {
        this.projectActivity.removeObserver(id);
    }

    addTrackable(trackable: ITrackable): void {
        trackable.addObserver(this);
        this.trackables.add(trackable.getId());
        trackable.getTrackingHistory().forEach((interval: TrackingInterval) => this.addIntervalToTrackingHistory(interval));
    }

    removeTrackable(id: uuidv4): void {
        this.projectActivity.getStore().getTrackableById(id)?.removeObserver(this.getId());
        this.trackables.delete(id);
    }

    getTrackable(searchId: uuidv4): ITrackable {
        if (this.projectActivity.getId() === searchId) {
            return this.projectActivity.getStore().getTrackableById(this.projectActivity.getId());
        } else {
            let result: ITrackable = null; // base case: has no trackables, and doesn't have an id that matches the search
            let trackableIdsArray: Array<uuidv4> = [...this.trackables];
            for (let i = 0; i < this.trackables.size; ++i) {
                let trackableId = trackableIdsArray[i];
                if (searchId === trackableId) {
                    return this.projectActivity.getStore().getTrackableById(trackableId);
                } else {
                    result = this.getStore().getTrackableById(trackableId)?.getTrackable(searchId);
                }
                if (result !== null) return result;
            }
            return result;
        }
    }

    getTrackables(): Array<ITrackable> {
        let result =  [...this.trackables].map(trackableId => this.projectActivity.getStore().getTrackableById(trackableId));
        return result;
    }

    // important: a project is tracked dynamically through its trackables, so that its total time is accurate after adding/removing
    // pre-existing trackables
    getTotalTrackedTime(format: TimeFormat = TimeFormat.HMS, sinceTimeSeconds: number = null): TimeObject {
        if (this.trackables.size > 0) {
            return [...this.trackables]
                .map((trackableId: uuidv4) => this.getTrackable(trackableId).getTotalTrackedTime(format, sinceTimeSeconds))
                .reduce((cumulativeSeconds: TimeObject, trackableTime: TimeObject) => {
                    return TimeObject.add(cumulativeSeconds, trackableTime, format);
                });
        } else {
            return new TimeObject(0, format);
        }
    }
    setTrackingHistory(trackingHistory: TrackingInterval[]) {
        this.projectActivity.setTrackingHistory(trackingHistory);
    }
    static fromObject(store: ITrackablesStore, trackableObject: Object): Project {
        let name = trackableObject['name'];
        let color = RGBColor.fromObject(trackableObject['color']);
        let project: Project = new Project(store, name, color);
        project.projectActivity = Activity.fromObject(store, trackableObject);
        project.trackables = new Set(trackableObject['trackables']);
        return project;
    }
    toObject(): Object {
        let prototypeObject = this.projectActivity.toObject();
        return Object.assign(prototypeObject, {trackables: [...this.trackables]});
    }
    static copy(project: Project): Project {
        return Project.fromObject(project.getStore(), project.toObject());
    }
    getType(): string {
        return "project";
    }
}