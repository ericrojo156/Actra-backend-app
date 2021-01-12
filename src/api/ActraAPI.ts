export interface IntervalProps {
    startTimeSeconds: number,
    endTimeSeconds: number
};

export interface RGBColor {
    red: number,
    green: number,
    blue: number
};

export enum TimeFormat {
    S,
    MS,
    HMS
};

export interface TimeJSObject {
    hours: number,
    mins: number,
    seconds: number
};

export interface TimeSpan {
    since: TimeJSObject,
    until: TimeJSObject
};

export interface Activity {
    id: string,
    name: string,
    color: RGBColor,
    trackingHistory: string[]
};

export enum TrackerState {
    INACTIVE,
    ACTIVE
}

export interface TimeObjectAPI {
    hours: number,
    mins: number,
    seconds: number
}

export interface TrackingIntervalAPI {
    id: string,
    startTimeSeconds: number,
    endTimeSeconds: number,
    state: string | TrackerState,
    duration: TimeObjectAPI
}

export interface TrackableAPI {
    id: string,
    type: string,
    name: string,
    color: RGBColor | null,
    trackablesIds: Set<string>[] | undefined,
    trackingHistory: Set<string>[] | undefined
}

export interface ActraAPI {
    storeObject();
    currentlyActive(): Promise<string>;
    trackables(timeSpan: TimeSpan);
    activityIntervals(activityId: string): Promise<TrackingIntervalAPI[]>;
    activities();
    projects();
    totalTrackedTime(trackableId: string, overTimeSpan: TimeSpan);
    save();
    load();
    rename(trackableId: string, newName: string);
    recolor(trackableId: string, newColor: RGBColor);
    start(trackableId: string);
    stop(trackableId: string);
    createActivity(name: string, rgbColor: RGBColor);
    createProject(name: string, rgbColor: RGBColor);
    join(name: string, trackables: string[], color: RGBColor);
    delete(trackableId: string);
    deleteInterval(intervalId: string);
    addTrackableToProject(projectId: string, trackableId: string);
    setTrackingInterval(intervalId: string, payload: IntervalProps);
    setIntervalTime(trackableId: string, intervalId: string, timeObject: TimeJSObject);
    setCurrentIntervalTime(trackableId: string, timeObject: TimeJSObject);
    convertActivityToProject(trackableId: string);
    convertProjectToActivity(trackableId: string);
    projectTrackables(projectId): TrackableAPI;
}