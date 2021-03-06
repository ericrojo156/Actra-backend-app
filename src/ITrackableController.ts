import { AnalyzedTrackableAPI, TimeSpan, TrackableAPI, TrackingIntervalAPI } from "./api/ActraAPI";
import {v4 as uuidv4} from 'uuid';

export default interface ITrackableController {
    storeIsLoaded: boolean;
    getAnalyzedTrackablesWithinTimeSpan(timeSpan: TimeSpan): AnalyzedTrackableAPI[];
    getTrackingIntervals(trackableId: uuidv4): TrackingIntervalAPI[];
    getCurrentlyActiveTrackableId();
    setCurrentlyActiveTrackableId(trackableId);
    removeTrackablesFromProject(projectId, trackablesIds);
    createActivity(name, color);
    createProject(name, color);
    deleteTrackable(trackableId, deleteTrackingIntervalsFromStore);
    deleteInterval(intervalId);
    joinTrackables(name, trackables, color, observersShouldForget);
    createAndReturnActivity(name, color);
    createAndReturnProject(name, color);
    addTrackableToProject(projectId, trackableId);
    saveStore();
    loadStore();
    serializeStore();
    serializeTrackable(trackable);
    getSerializedActivities();
    getSerializedProjects();
    getActivityObjects();
    getProjectObjects();
    getBasicTrackableInfo(target);
    startTrackable(trackableId);
    stopTrackable(trackableId);
    getStoreId();
    toTrackableObject(trackable);
    getTrackablesIdsWithinTimeSpan(timeSpan);
    getTotalTrackedTime(id, overTimeSpan, format);
    getStoreObject();
    renameTrackable(id, newName);
    recolorTrackable(id, color);
    setIntervalTime(trackableId, intervalId, timeObj);
    setTrackingInterval(intervalId, payload);
    setCurrentIntervalTime(trackableId, timeObject);
    convertActivityToProject(id);
    convertProjectToActivity(id);
    setTrackingHistory(trackableId, intervals);
    getProjectTrackables(id: uuidv4): TrackableAPI[];
    getTrackablesWithinTimeSpan(timeSpan: TimeSpan): TrackableAPI[]
}