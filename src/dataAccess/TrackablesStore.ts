import { Activity } from "../trackable/Activity";
import { Project } from "../trackable/Project";
import { ITrackablesStore } from "./ITrackablesStore";
import { v4 as uuidv4 } from "uuid";
import { ITrackable } from "../trackable/ITrackable";
import { TimeFormat, TimeObject } from "../trackable/TimeObject";
import { TrackingInterval } from "../trackable/TrackingInterval";
import { TrackingIntervalAPI } from "../api/ActraAPI";

export class TrackablesStore implements ITrackablesStore {
    private trackingIntervals: Map<uuidv4, TrackingInterval>;
    version: string;
    storeType: string;
    registeredTrackableNames: Map<string, uuidv4>;
    activities: Map<uuidv4, Activity>;
    projects: Map<uuidv4, Project>;
    intervalsToTrackables: Map<uuidv4, uuidv4>;
    private currentlyActiveTrackableId: uuidv4;
    readonly id: uuidv4;
    constructor(version: string, storeType: string, id: uuidv4 = uuidv4()) {
        this.version = version;
        this.storeType = storeType;
        this.activities = new Map();
        this.projects = new Map();
        this.id = id;
        this.trackingIntervals = new Map();
        this.registeredTrackableNames = new Map();
        this.intervalsToTrackables = new Map();
        this.currentlyActiveTrackableId = null;
    }
    getIntervalsToTrackables(): Object[] {
        return [...this.intervalsToTrackables.entries()].map((keyPair) => {return {'intervalId': keyPair[0], 'trackableId': keyPair[1]}});
    }
    deleteTrackingInterval(intervalId: uuidv4) {
        this.trackingIntervals.delete(intervalId);
        this.intervalsToTrackables.delete(intervalId);
    }
    getCorrespondingTrackableOfInterval(intervalId: any): uuidv4 {
        return this.intervalsToTrackables.get(intervalId);
    }

    async setTrackableName(trackableId: any, name: string): Promise<ITrackable> {
        let trackable: ITrackable = this.getTrackableById(trackableId);
        this.registeredTrackableNames.delete(trackable.getName());
        trackable.setName(name);
        this.registeredTrackableNames.set(trackable.getName(), trackable.getId());
        return trackable;
    }

    getAllTrackingIntervals(): TrackingInterval[] {
        return [...this.trackingIntervals.values()];
    }

    deleteTrackable(id: uuidv4, deleteTrackingIntervalsFromStore: boolean = true): Promise<void> {
        return new Promise(resolve => {
            if (this.activities.has(id)) {
                let activity: Activity = this.activities.get(id);
                if (deleteTrackingIntervalsFromStore) {
                    activity?.getTrackingHistory().forEach((trackingInterval: TrackingInterval) => {
                        this.deleteTrackingInterval(trackingInterval.getId());
                    });
                }
                activity?.getObservers().forEach((observerId: uuidv4) => {
                    this.getProjects().get(observerId)?.removeTrackable(id);
                });
                this.registeredTrackableNames.delete(activity.getName());
                this.activities.delete(id);
                resolve();
            }
            if (this.projects.has(id)) {
                let project: Project = this.projects.get(id);
                if (deleteTrackingIntervalsFromStore) {
                    project?.getTrackingHistory().forEach((trackingInterval: TrackingInterval) => {
                        this.deleteTrackingInterval(trackingInterval.getId());
                    });
                }
                project?.getObservers().forEach((observerId: uuidv4) => {
                    this.getProjects().get(observerId)?.removeTrackable(id);
                });
                project?.trackables.forEach(
                    (trackableId: ITrackable) => {
                        project.removeTrackable(trackableId);
                    }
                )
                this.registeredTrackableNames.delete(project.getName());
                this.projects.delete(id);
                resolve();
            }
        })
    }

    setTrackingHistory(trackableId: uuidv4, trackingIntervals: TrackingInterval[]): void {
        this.getTrackableById(trackableId).setTrackingHistory(trackingIntervals);
        trackingIntervals.forEach((interval: TrackingInterval) => {
            if (!this.trackingIntervals.has(interval.getId()) && !this.intervalsToTrackables.has(interval.getId())) {
                this.trackingIntervals.set(interval.getId(), interval);
                this.intervalsToTrackables.set(interval.getId(), trackableId);
            }
        });
    }

    setIntervalsToTrackablesMap(storeObject): void {
        storeObject['intervalsToTrackables'].forEach((pair: Object) => {
            if (pair['intervalId'] && pair['trackableId']) {
                if (pair['intervalId'] && !this.intervalsToTrackables.has(pair['intervalId'])) {
                    this.intervalsToTrackables.set(pair['intervalId'], pair['trackableId']);
                }
            } else {
                console.log(`pair object is invalid: ${pair}, cannot add intervalId/trackableId pair to store intervalsToTrackables map.`);
            }
        });
    }

    setTrackingIntervals(storeObject: Object): void {
        storeObject['trackingIntervals']?.forEach((trackingObj: Object) => {
            let trackingInterval: TrackingInterval = TrackingInterval.fromObject(trackingObj);
            this.trackingIntervals.set(trackingInterval.getId(), trackingInterval);
        });
    }

    getTrackingInterval(id: number): TrackingInterval {
        return this.trackingIntervals.get(id);
    }

    addTrackingInterval(trackingInterval: TrackingInterval, trackableId: uuidv4): void {
        if (!this.trackingIntervals.has(trackingInterval.getId()) && !this.intervalsToTrackables.has(trackingInterval.getId())) {
            this.trackingIntervals.set(trackingInterval.getId(), trackingInterval);
            this.intervalsToTrackables.set(trackingInterval.getId(), trackableId);
        }
    }

    getCurrentlyActiveTrackableId() {
        return this.currentlyActiveTrackableId || null;
    }

    setCurrentlyActiveTrackableId(trackableId) {
        this.currentlyActiveTrackableId = trackableId;
    }

    getVersion(): string {
        return this.version;
    }

    getStoreType(): string {
        return this.storeType;
    }

    getId(): uuidv4 {
        return this.id;
    }

    getActivities(): Map<uuidv4, Activity> {
        return this.activities;
    }

    getProjects(): Map<uuidv4, Project> {
        return this.projects;
    }

    setActivities(trackables: Array<Activity>): void {
        trackables.forEach(
            activity => this.activities.set(activity.getId(), activity)
        );
    }

    setProjects(trackables: Array<Project>): void {
        trackables.forEach(
            project => this.projects.set(project.getId(), project)
        );
    }

    getAllTrackableIds(): Array<uuidv4> {
        let ids: Array<uuidv4> = [...this.activities.keys()];
        ids.push(...this.projects.keys());
        return ids;
    }
    getTrackableById(id: uuidv4): ITrackable {
        let result: ITrackable = this.activities.get(id);
        if (!result) {
            result = this.projects.get(id);
        }
        return result || null;
    }
    nameIsRegistered(name: string): boolean {
        return this.registeredTrackableNames.has(name);
    }
    putTrackable(trackable: ITrackable): void {
        let name = trackable.getName();
        if (this.nameIsRegistered(name)) {
            throw Error(`failed to create trackable ${trackable.getId()}: name ${name} is already associated with trackable ${this.registeredTrackableNames.get(name)}`)
        }
        if (trackable instanceof Project) {
            this.projects.set(trackable.getId(), trackable);
        } else if (trackable instanceof Activity) {
            this.activities.set(trackable.getId(), trackable);
        }
    }
    addTrackableToProject(projectId: uuidv4, trackableId: uuidv4): boolean {
        let successfullyAdded: boolean = false;
        let project: Project = this.projects.get(projectId);
        let trackable: ITrackable = this.getTrackableById(trackableId);
        // add the trackable's reference to the project's trackables if and only if both the trackable and project exist
        // in the store.
        if (trackable !== null && project !== null) {
            project.addTrackable(trackable);
            successfullyAdded = true;
        }
        return successfullyAdded;
    }
    getTotalTrackedTime(id: uuidv4, overTimeSpan: Object, format: TimeFormat): TimeObject {
        return this.getTrackableById(id).getTotalTrackedTime(format, overTimeSpan);
    }
    getTrackingIntervals(): TrackingIntervalAPI[] {
        return [...this.trackingIntervals.values()].map((interval: TrackingInterval) => interval.toObject());
    }
    toObject(): Object {
        return {
            version: this.getVersion(),
            type: this.getStoreType(),
            id: this.getId(),
            activities: [...this.activities.values()].map(((activity: Activity) => activity.toObject())),
            projects: [...this.projects.values()].map((project: Project) => project.toObject()),
            trackingIntervals: [...this.trackingIntervals.values()].map((interval: TrackingInterval) => interval.toObject()),
            registeredTrackableNames: [...this.registeredTrackableNames.values()],
            intervalsToTrackables: [...this.intervalsToTrackables.values()],
            currentlyActiveTrackableId: this.getCurrentlyActiveTrackableId()
        };
    }
}
