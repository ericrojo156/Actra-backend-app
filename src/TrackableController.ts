import { IPersistentAndSerializableStore } from "./dataAccess/IPersistentAndSerializableStore";
import { Activity } from "./trackable/Activity";
import { Project } from "./trackable/Project";
import { TrackableType } from "./trackable/TrackableType";
import {v4 as uuidv4} from "uuid";
import { ILogger, Logger } from "./Logger";
import { ITrackable } from "./trackable/ITrackable";
import { TimeFormat, TimeObject } from "./trackable/TimeObject";
import { TrackingInterval, IntervalProps } from "./trackable/TrackingInterval";
import { RGBColor } from "./trackable/RGBColor";
import { TrackingState } from "./trackable/TrackingState";
import ITrackableController from "./ITrackableController";
import {Activity as ActivityActraAPI, TrackableAPI, TrackingIntervalAPI} from "./api/ActraAPI";

export class TrackableController implements ITrackableController {
    store: IPersistentAndSerializableStore;
    logger: ILogger;
    currentlyActiveTrackableId: uuidv4;
    storeIsLoaded: boolean;
    constructor(store: IPersistentAndSerializableStore, logger: ILogger = new Logger()) {
        this.storeIsLoaded = false;
        this.store = store;
        this.logger = logger;
        this.setCurrentlyActiveTrackableId(this.store.getCurrentlyActiveTrackableId());
    }
    public async getActivity(id: uuidv4): Promise<ActivityActraAPI> {
        const activity: Activity = this.store.getActivities().get(id);
        return {
            id: activity.getId(),
            name: activity.getName(),
            color: activity.getColor(),
            trackingHistory: activity.getTrackingHistory().map(interval => interval.id)
        };
    }
    public getTrackingIntervals(trackableId): TrackingIntervalAPI[] {
        return this.store.getTrackingIntervals(trackableId);
    }
    public getProjectTrackables(id: uuidv4): TrackableAPI[] {
        return this.store.getProjects().get(id).getTrackables().map((trackable: ITrackable) => {
            return {
                id: trackable.getId(),
                type: trackable.getType(),
                name: trackable.getName(),
                color: trackable.getColor(),
                trackablesIds: trackable.getType() === 'project' ? [...(trackable as Project).trackables.values()] : undefined,
                trackingHistory: trackable.getTrackingHistory().map((interval: TrackingInterval) => interval.getId())
            }
        });
    }
    public getCurrentlyActiveTrackableId() {
        if (typeof(this.currentlyActiveTrackableId) === 'undefined') {
            this.currentlyActiveTrackableId = this.store.getCurrentlyActiveTrackableId() || null;
        }
        return this.currentlyActiveTrackableId;
    }
    public setCurrentlyActiveTrackableId(trackableId) {
        this.store.setCurrentlyActiveTrackableId(trackableId);
        this.currentlyActiveTrackableId = trackableId;
    }
    private create(type: TrackableType, name: string, color: RGBColor): uuidv4 {
        // will call different methods using polymorphism, based on argument type of Activity or Project
        if (type == TrackableType.ACTIVITY) {
            let activity: Activity = new Activity(this.store, name, color);
            this.store.putTrackable(activity);
            return activity.getId();
        } else {
            let project: Project = new Project(this.store, name, color);
            this.store.putTrackable(project);
            return project.getId();
        }
    }
    removeTrackablesFromProject(projectId: uuidv4, trackablesIds: uuidv4[]) {
        let project = this.store.getProjects().get(projectId);
        trackablesIds.forEach(id => project?.removeTrackable(id));
    }
    createActivity(name: string, color: RGBColor = new RGBColor()): uuidv4 {
        return this.create(TrackableType.ACTIVITY, name, color);
    }
    createProject(name: string, color: RGBColor = new RGBColor()): uuidv4 {
        return this.create(TrackableType.PROJECT, name, color);
    }
    async deleteTrackable(trackableId: uuidv4, deleteTrackingIntervalsFromStore: boolean = true): Promise<boolean> {
        return await this.store.deleteTrackable(trackableId, deleteTrackingIntervalsFromStore);
    }
    async deleteInterval(intervalId: uuidv4): Promise<any> {
        this.store.getTrackableById(this.store.getCorrespondingTrackableOfInterval(intervalId)).deleteInterval(intervalId);
        this.store.deleteTrackingInterval(intervalId);
    }
    async joinTrackables(name: string, trackables: uuidv4[], color: RGBColor = null, observersShouldForget = false): Promise<Object> {
        let preservedTrackingIntervals = [];
        let tempProject = this.createAndReturnProject(name, color || this.store.getTrackableById(trackables[0]).getColor());
        let newTrackableId = tempProject.getId();
        trackables.forEach((trackableId: uuidv4) => tempProject.addTrackable(this.store.getTrackableById(trackableId)));
        await this.convertProjectToActivity(tempProject.getId());
        await Promise.all(
            trackables.map((deprecatedTrackableId: uuidv4) => {
                let deprecatedTrackable = this.store.getTrackableById(deprecatedTrackableId);
                if (!deprecatedTrackable) {
                    throw new Error(`Error: Trackable ${deprecatedTrackableId} does not exist in store ${this.store.getId()}`);
                }
                // if the deprecated trackables had observers, then decide if those observers should start observing the newly joined trackable instead
                if (!observersShouldForget) {
                    let observers = [...deprecatedTrackable.getObservers()];
                    observers.forEach(
                        (observerId: uuidv4) => {
                            this.removeTrackablesFromProject(observerId, [deprecatedTrackableId]);
                            this.addTrackableToProject(observerId, newTrackableId);
                        }
                    );
                }
                deprecatedTrackable.getTrackingHistory().forEach(interval => preservedTrackingIntervals.push(interval));
                return this.store.deleteTrackable(deprecatedTrackableId, false);
            })
        );
        this.store.setTrackingHistory(newTrackableId, preservedTrackingIntervals)
        return this.store.getTrackableById(newTrackableId).toObject();
    }
    createAndReturnActivity(name: string, color: RGBColor = new RGBColor()): Activity {
        let newActivity: Activity = this.store.getTrackableById(this.createActivity(name, color)) as Activity;
        this.saveStore();
        return newActivity;
    }
    createAndReturnProject(name: string, color: RGBColor = new RGBColor()): Project {
        let newProject: Project = this.store.getTrackableById(this.createProject(name, color)) as Project;
        this.saveStore();
        return newProject;
    }
    addTrackableToProject(projectId: uuidv4, trackableId: uuidv4): boolean {
        try {
            let project: Project = this.store.getProjects().get(projectId);
            if (project && (project.getId() !== trackableId) && (project.getTrackable(trackableId) === null)) {
                project.addTrackable(this.store.getTrackableById(trackableId));
                this.saveStore();
                return true;
            } else {
                if (!project) {
                    this.logger.log(`Project ${projectId} does not exist in store ${this.store.getId()}.`);
                } else if (project.getId() === trackableId) {
                    this.logger.log(`Project ${projectId} cannot add trackable with identical ID to its trackables.`);
                } else if (project.getTrackable(trackableId) !== null) {
                    this.logger.log(`Trackable ${trackableId} already exists as a descendant trackable of project ${projectId}.`);
                } else {
                    this.logger.log(`Could not add trackable ${trackableId} to project ${projectId} for unknown reasons.`);
                }
                return false;
            }
        } catch (e) {
            this.logger.log(e);
            return false;
        }
    }
    async saveStore(): Promise<boolean> {
        return this.store.save();
    }
    async loadStore(): Promise<boolean> {
        const result = await this.store.load();
        this.storeIsLoaded = true;
        return result;
    }
    serializeStore(): string {
        return this.store.serialize();
    }
    serializeTrackable(trackable: ITrackable): string {
        return this.store.serializeTrackable(trackable);
    }
    getSerializedActivities(): Array<string> {
        return [...this.store.getActivities().values()].map((activity: Activity) => this.store.serializeTrackable(activity));
    }
    getSerializedProjects(): Array<string> {
        return [...this.store.getProjects().values()].map((projects: Project) => this.store.serializeTrackable(projects));
    }
    getActivityObjects(): Array<Object> {
        return [...this.store.getActivities().values()].map((activity: Activity) => this.toTrackableObject(activity));
    }
    getProjectObjects(): Array<Object> {
        return [...this.store.getProjects().values()].map((project: Project) => this.toTrackableObject(project));
    }
    getBasicTrackableInfo(target: uuidv4 | ITrackable): Object {
        let trackable: ITrackable;
        if (typeof target === 'string') {
            trackable = this.store.getTrackableById(target);
        } else {
            trackable = target;
        }
        let returnObject = {};
        returnObject['name'] = trackable.getName();
        returnObject['trackableType'] = trackable instanceof Project ? "project" : "activity";
        returnObject['trackingState'] = trackable.getTrackingState();
        returnObject['trackableId'] = trackable.getId();
        return returnObject;
    }
    startTrackable(trackableId: number): any {
        let trackable: ITrackable = this.store.getTrackableById(trackableId);
        if (trackable !== null) {
            let returnObject: Object = this.getBasicTrackableInfo(trackable);
            let currentlyActiveTrackableId = this.getCurrentlyActiveTrackableId();
            if (currentlyActiveTrackableId !== trackableId) {
                if (currentlyActiveTrackableId && currentlyActiveTrackableId !== trackableId) {
                    this.store.getTrackableById(currentlyActiveTrackableId)?.stopTracking();
                }
                if (trackable instanceof Activity) {
                    this.setCurrentlyActiveTrackableId(trackableId);
                }
                trackable.startTracking();
                this.saveStore();
                returnObject['action'] = 'startTracking'; 
                returnObject['status'] = 'success';
            } else {
                returnObject['status'] = `already tracking trackable ${trackableId}`;
            }
            returnObject['action'] = 'startTracking';
            this.saveStore();
            return returnObject;
        } else {
            this.logger.log(`failed to start trackable ${trackableId}: not in store ${this.store.getId()}`);
            return {status: 'error', msg: `failed to start trackable ${trackableId}: not in store ${this.store.getId()}`};
        }
    }
    stopTrackable(trackableId: number): any {
        let trackable: ITrackable = this.store.getTrackableById(trackableId);
        if (trackable !== null) {
            trackable.stopTracking();
            this.setCurrentlyActiveTrackableId(null);
            let returnObject = this.getBasicTrackableInfo(trackable);
            returnObject['action'] = 'stopTracking';
            returnObject['currentIntervalTime'] = trackable.getCurrentInterval()?.toTimeObject(TimeFormat.HMS).toObject();
            this.saveStore();
            return returnObject;
        } else {
            this.logger.log(`failed to stop trackable ${trackableId}: not in store ${this.store.getId()}`);
            return {status: 'error'};
        }
    }
    getStoreId(): uuidv4 {
        return this.store.getId();
    }
    toTrackableObject(trackable: ITrackable): Object {
        return trackable.toObject();
    }
    getTrackablesIdsWithinTimeSpan(timeSpan: Object): Object[] {
        if (typeof(timeSpan) !== 'object' || timeSpan === null) {
            return this.store.getAllTrackableIds().map((id: uuidv4) => this.store.getTrackableById(id));
        }
        let sinceSeconds = (typeof(timeSpan['since']) === 'undefined') || timeSpan['since'] === null ? 0 : (Date.now() / 1000) - TimeObject.fromObject(timeSpan['since']).getTotalSeconds();
        let untilSeconds = (typeof(timeSpan['until']) === 'undefined') || timeSpan['until'] === null ? ((Date.now() / 1000) + 100): (Date.now() / 1000) - TimeObject.fromObject(timeSpan['until']).getTotalSeconds();
        let intervals = this.store.getAllTrackingIntervals()
            .filter((interval: TrackingInterval) => {
                return (sinceSeconds <= interval.startTimeSeconds)
                    || ((interval.startTimeSeconds < sinceSeconds)
                        && ((sinceSeconds < interval.endTimeSeconds) || (interval.getTrackingState() === TrackingState.ACTIVE))
                    )
            })
            .filter((interval: TrackingInterval) => {
                return interval.startTimeSeconds <= untilSeconds
            })
        let selectedIntervalsMap: Map<uuidv4, uuidv4[]> = new Map();
        let trackableIds: uuidv4[] = intervals.map((interval: TrackingInterval) => {
            let trackableId = this.store.getCorrespondingTrackableOfInterval(interval.getId());
            if (!selectedIntervalsMap.has(trackableId)) {
                selectedIntervalsMap.set(trackableId, [interval.getId()])
            } else {
                selectedIntervalsMap.get(trackableId).push(interval.getId());
            }
            return trackableId;
        });
        return [...(new Set(trackableIds).values())].map((trackableId: uuidv4) => {
            let returnObject = this.getBasicTrackableInfo(trackableId);
            let selectedIntervals = selectedIntervalsMap.get(trackableId).map((id: uuidv4) => this.store.getTrackingInterval(id));
            Object.assign(returnObject, {
                'selectedIntervals': selectedIntervals,
                'selectedTime': selectedIntervals
                                .map((interval: TrackingInterval) => interval.toTimeObject())
                                .reduce((prev: TimeObject, curr: TimeObject) => TimeObject.add(prev, curr))
                                .toObject()
            });
            return returnObject;
        });
    }

    // overTimeSpan is a time diff from the present to the start of the time frame
    // sinceTimeSeconds is the absolute time since epoch for the start of the time frame
    getTotalTrackedTime(id: uuidv4, overTimeSpan: Object = null, format: TimeFormat = TimeFormat.HMS): Object {
        let returnObject: Object = this.getBasicTrackableInfo(id);
        returnObject['trackedTime'] = this.store.getTotalTrackedTime(id, overTimeSpan, format).toObject();
        return returnObject;
    }
    getStoreObject(): Object {
        return this.store.toObject();
    }
    async renameTrackable(id: uuidv4, newName: string): Promise<Object> {
        if (this.store.nameIsRegistered(newName)) {
            return {
                'error': `name ${newName} is already associated with a trackable`,
                'name': newName
            };
        }
        let trackable: ITrackable = await this.store.setTrackableName(id, newName);
        this.saveStore();
        let returnObject: Object = this.getBasicTrackableInfo(trackable);
        returnObject['name'] = trackable.getName();
        return returnObject;
    }
    recolorTrackable(id: uuidv4, color: RGBColor): Object {
        let trackable: ITrackable = this.store.getTrackableById(id);
        trackable.setColor(color);
        this.saveStore();
        let returnObject: Object = this.getBasicTrackableInfo(trackable);
        returnObject['color'] = trackable.getColor();
        return returnObject;
    }
    setIntervalTime(trackableId: string, intervalId: number, timeObj: object): Object {
        let timeObject: TimeObject = TimeObject.fromObject(timeObj);
        let newTime = this.store.getTrackableById(trackableId).setIntervalTime(intervalId, timeObject)?.toObject() || null;
        this.saveStore();
        return newTime;
    }
    setTrackingInterval(intervalId: string, payload: IntervalProps): Object {
        return this.store.getTrackingInterval(intervalId).setFields(payload).toObject();
    }
    setCurrentIntervalTime(trackableId: string, timeObject: TimeObject): Object {
        let trackable: ITrackable = this.store.getTrackableById(trackableId);
        if (trackable === null) {
            throw Error(`trackable ${trackableId} doesn't exist in the store`);
        }
        return this.setIntervalTime(trackable.getId(), trackable.getCurrentInterval().getId(), timeObject);
    }
    convertActivityToProject(id: string): Object {
        try {
            let activity: Activity = this.store.getActivities().get(id);
            if (activity !== null) {
                let project: Project = new Project(this.store, activity.getName(), activity.getColor(), activity.getId());
                project.projectActivity = Activity.copy(activity);
                let inheritedActivity: Activity = this.createAndReturnActivity(`${project.getName()}_inherited_tracking_intervals`);
                inheritedActivity.setTrackingHistory(activity.getTrackingHistory());
                project.addTrackable(inheritedActivity);
                project.setCurrentInterval(activity.getCurrentInterval()?.getId() || null);
                this.store.putTrackable(project);
                this.store.getActivities().delete(activity.getId());
                this.saveStore();
                return project.toObject();
            } else {
                return null;
            }
        } catch (e) {
            return null;
        }
    }
    async convertProjectToActivity(id: string): Promise<Object> {
        try {
            let project: Project = this.store.getProjects().get(id);
            if (project !== null) {
                let projectTrackingHistory = project.getTrackingHistory();
                let currentInterval = project.getCurrentInterval()?.getId() || null;
                let projectName = project.getName();
                let projectColor = project.getColor();
                let projectId = project.getId();
                await this.store.deleteTrackable(id, false);
                let activity: Activity = new Activity(this.store, projectName, projectColor, projectId);
                activity.setTrackingHistory(projectTrackingHistory);
                activity.setCurrentInterval(currentInterval);
                this.store.putTrackable(activity);
                this.saveStore();
                return activity.toObject();
            } else {
                return null;
            }
        } catch (e) {
            return null;
        }
    }
    setTrackingHistory(trackableId: uuidv4, intervals: TrackingInterval[]) {
        this.store.setTrackingHistory(trackableId, intervals);
        this.store.getTrackableById(trackableId).getObservers().forEach(id => this.store.setTrackingHistory(id, intervals));
        this.saveStore();
    }
}