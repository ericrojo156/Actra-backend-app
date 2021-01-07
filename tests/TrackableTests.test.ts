const rmfr = require('rmfr');
import { Activity } from "../src/trackable/Activity";
import { Project } from "../src/trackable/Project";
import { TimeFormat, TimeObject } from "../src/trackable/TimeObject";
import { TrackingInterval } from "../src/trackable/TrackingInterval";
import { TrackingState } from "../src/trackable/TrackingState";
import { TrackableController } from "../src/TrackableController";
import { IPersistentAndSerializableStore } from "../src/dataAccess/IPersistentAndSerializableStore";
import * as assert from "assert"
import { ITrackable } from "../src/trackable/ITrackable";
import { JsonPersistentStore, JSONStoreDeserializer } from "../src/dataAccess/JsonPersistentStore";
import {v4 as uuidv4} from "uuid";
import { ITrackablesStore } from "../src/dataAccess/ITrackablesStore";
import * as fs from "fs";
import { FileSystemStorePersistence } from "../src/dataAccess/FileSystemStorePersistence";
import { IPersistentStore } from "../src/dataAccess/IPersistentStore";
import { NoLogger } from "../src/Logger";
import { StorePersistenceMock } from "./StorePersistenceMock";
import { RGBColor } from "../src/trackable/RGBColor";

function track(trackable: ITrackable, ms: number): Promise<ITrackable> {
    trackable.startTracking();
    let trackingPromise = new Promise<ITrackable>(
        (resolve) => {
            setTimeout(
                () => {
                    trackable.stopTracking();
                    resolve(trackable);
                },
                ms
            );
        }
    ).catch(e => {assert(false, "Error thrown in tracking promise: " + e)});
    return trackingPromise;
}

function numbersAreWithinAcceptablePrecision(num1: number, num2: number, precision: number = 0.1): boolean {
    return Math.abs(num1 - num2) < precision;
}

function activityEquals(lhs: Activity, rhs: Activity) {
    let lhsTrackingHistory = lhs.getTrackingHistory();
    let rhsTrackingHistory = rhs.getTrackingHistory();
    let trackingHistoryResult: boolean = lhsTrackingHistory.length === rhsTrackingHistory.length;
    if (trackingHistoryResult) {
        for (let i = 0; i < lhs.getTrackingHistory().length; ++i) {
            trackingHistoryResult = trackingHistoryResult && lhsTrackingHistory[i].equals(rhsTrackingHistory[i]);
        }
    }
    return lhs.getId() === rhs.getId()
        && lhs.getName() === rhs.getName()
        && lhs.getColor().equals(rhs.getColor())
        && trackingHistoryResult
        && lhs.getObservers().size === rhs.getObservers().size
        && [...lhs.getObservers()].every(entry => rhs.getObservers().has(entry))
        && ((typeof (lhs.getCurrentInterval()) === 'undefined' && typeof(rhs.getCurrentInterval()) === 'undefined') || (lhs.getCurrentInterval() === null && rhs.getCurrentInterval() === null) || lhs.getCurrentInterval()?.equals(rhs.getCurrentInterval()));
}

function projectEquals(lhs: Project, rhs: Project) {
    return activityEquals(lhs.projectActivity, rhs.projectActivity)
        && lhs.trackables.size === rhs.trackables.size
        && [...lhs.trackables].every(id => rhs.trackables.has(id));
}

function storesAreEqual(lhs: ITrackablesStore, rhs: ITrackablesStore) {
    assert(
        lhs.getAllTrackableIds()
            .every((id: uuidv4) => 
                rhs.getAllTrackableIds()
                    .includes(id)
            )
    );
    assert(
        [...lhs.getActivities().values()]
            .every((activity: Activity) => 
                {
                    let match: Activity = rhs.getTrackableById(activity.getId()) as Activity;
                    return match !== null && activityEquals(match, activity)
                }
            )
    );
    assert(
        [...lhs.getProjects().values()]
            .every((project: Project) => 
                {
                    let match: Project = rhs.getTrackableById(project.getId()) as Project;
                    return match !== null && projectEquals(match, project);
                }
            )
    );
}

describe("TimeObject", function() {
    it("should accurately resolve hours, minutes, and seconds if format is HMS", function() {
        let expectedHours = 30;
        let expectedMinutes = 24;
        let expectedSeconds = 35;
        let timeObject: TimeObject = new TimeObject(
            expectedSeconds + (expectedMinutes * 60) + (expectedHours * 60 * 60),
            TimeFormat.HMS
        );
        let obj = timeObject.toObject();
        assert(obj['seconds'] === expectedSeconds);
        assert(obj['mins'] === expectedMinutes);
        assert(obj['hours'] === expectedHours);
    });
    it("should accurately resolve minutes and seconds if format is MS", function() {
        let expectedHours = 0;
        let expectedMinutes = 24 + (30 * 60);
        let expectedSeconds = 35;
        let timeObject: TimeObject = new TimeObject(
            expectedSeconds + (expectedMinutes * 60) + (expectedHours * 60 * 60),
            TimeFormat.MS
        );
        let obj = timeObject.toObject();
        assert(obj['seconds'] === expectedSeconds);
        assert(obj['mins'] === expectedMinutes);
        assert(obj['hours'] === expectedHours);
    });
    it('should be constructible from object representation', function() {
        let expectedSeconds = 12;
        let expectedMins = 45;
        let expectedHours = 30;
        let timeObj = {seconds: expectedSeconds, mins: expectedMins, hours: expectedHours};
        let timeObject: TimeObject = TimeObject.fromObject(timeObj);
        assert(numbersAreWithinAcceptablePrecision(timeObject.getSeconds(), expectedSeconds));
        assert(numbersAreWithinAcceptablePrecision(timeObject.getMins(), expectedMins));
        assert(numbersAreWithinAcceptablePrecision(timeObject.getHours(), expectedHours));
    });
    it("should be able to add multiple time objects", function() {
        let values = [
            12,
            23,
            33,
            23
        ];
        let timeObjects = values.map((value: number) => new TimeObject(value));
        let timeObjectSum = TimeObject.addMultiple(...timeObjects).getTotalSeconds();
        assert(timeObjectSum === values.reduce((acc, curr) => acc + curr));
    }); 
});

describe("RGBColor", function() {
    it("should assign correct rgb values", async function() {
        let rgbColor: RGBColor = new RGBColor(10, 20, 30);
        assert(rgbColor.red == 10);
        assert(rgbColor.green == 20);
        assert(rgbColor.blue == 30);
    });
    it("should impose 255 as the numeric limits for rgb values", async function() {
        let rgbColor: RGBColor = new RGBColor(300, 400, 500);
        assert(rgbColor.red === 255);
        assert(rgbColor.green === 255);
        assert(rgbColor.blue === 255);
    });
    it("should interpret negative or NaN rgb values as zeros", async function() {
        let rgbColor: RGBColor = new RGBColor(-1, -3, -300);
        assert(rgbColor.red === 0);
        assert(rgbColor.green === 0);
        assert(rgbColor.blue === 0);
        let rgbColor2 = new RGBColor(NaN, NaN, NaN);
        assert(rgbColor2.red === 0);
        assert(rgbColor2.green === 0);
        assert(rgbColor2.blue === 0);
    });
    it("should produce correct object representation", async function() {
        let rgbColorObject: Object = new RGBColor(10, 20, 30).toObject();
        assert(rgbColorObject['red'] === 10);
        assert(rgbColorObject['green'] === 20);
        assert(rgbColorObject['blue'] === 30);
    });
});
describe("Activity", function() {
    let store: IPersistentAndSerializableStore = null;
    let controller = null;
    this.timeout(15000);
    beforeEach(function() {  
        store = new JsonPersistentStore(new StorePersistenceMock());
        controller = new TrackableController(store, new NoLogger());
    });
    it("should have state set to ACTIVE while actively tracking", function() {
        let activity: Activity = controller.createAndReturnActivity("gynmastics", new RGBColor(0, 128, 128));
        activity.startTracking();
        assert(activity instanceof Activity);
        assert((activity.getTrackingState() === TrackingState.ACTIVE) && activity.getTrackingState());
    });
    it("should have state set to INACTIVE when not actively tracking", async function() {
        let id: uuidv4 = controller.createActivity("gynmastics", new RGBColor(0, 128, 128));
        let activity: ITrackable = store.getTrackableById(id);
        await track(activity, 1000)
            .then(() => assert((activity.getTrackingState() === TrackingState.INACTIVE) && !activity.getTrackingState()));
    });
    it("should have three tracking intervals in tracking history after undergoing three tracking sessions", async function() {
        let id: uuidv4 = controller.createActivity("gynmastics", new RGBColor(0, 128, 128));
        let activity: ITrackable = store.getTrackableById(id);
        await track(activity, 1000)
            .then(trackable => track(trackable, 2000))
            .then(trackable => track(trackable, 3000))
            .then(trackable => {
                let history: Array<TrackingInterval> = trackable.getTrackingHistory();
                let expected = 3;
                assert(expected === history.length, `expected ${expected} intervals in tracking history for trackable, but got ${history.length}`);
                let expectedTotalTime: number = 0;
                for (let i = 1; i < 4; ++i) {
                    let intervalSeconds: number = history[i - 1].toTimeObject(TimeFormat.S).getTotalSeconds();
                    expectedTotalTime += intervalSeconds;
                    assert(numbersAreWithinAcceptablePrecision(i, intervalSeconds), `expected interval time of ${i} seconds, but got ${intervalSeconds}`);
                }
                let actualTotalTime: number = trackable.getTotalTrackedTime(TimeFormat.S, null).getTotalSeconds();
                assert(numbersAreWithinAcceptablePrecision(expectedTotalTime, actualTotalTime), `expected total time of ${expectedTotalTime}, but got actual total time of ${actualTotalTime}`);
            });
    });
    it("should be able to set color", async function() {
        let id: uuidv4 = controller.createActivity("gynmastics", new RGBColor(0, 0, 0));
        let activity: Activity = store.getTrackableById(id) as Activity;
        let colorObj = activity.getColor().toObject();
        assert(colorObj['red'] === 0);
        assert(colorObj['green'] === 0);
        assert(colorObj['blue'] === 0);
        activity.setColor(new RGBColor(10, 20, 30));
        colorObj = activity.getColor().toObject();
        assert(colorObj['red'] === 10);
        assert(colorObj['green'] === 20);
        assert(colorObj['blue'] === 30);
    });
    it("should be able to set name", async function() {
        let originalName = "gynmastics";
        let newName = "exercise";
        let id: uuidv4 = controller.createActivity(originalName, new RGBColor(0, 0, 0));
        let activity: Activity = store.getTrackableById(id) as Activity;
        assert(activity.getName() === originalName);
        activity.setName(newName);
        assert(activity.getName() === newName);
    });
    it("should accurately report total tracked time", async function() {
        let activity: Activity = controller.createAndReturnActivity("activity2");
        let t1 = {'hours': 48};
        let t2 = {'hours': 30};
        let t3 = {'hours': 5};
        let t4 = {'hours': 2};
        let sevenDaysAgo = (Date.now() / 1000) - TimeObject.fromObject({"hours": 24 * 7}, TimeFormat.HMS).getTotalSeconds();
        let interval1 = TrackingInterval.fromObject({
            startTimeSeconds: sevenDaysAgo,
            endTimeSeconds: sevenDaysAgo + TimeObject.fromObject(t1, TimeFormat.HMS).getTotalSeconds()
        });
        let threeDaysAgo = (Date.now() / 1000) - TimeObject.fromObject({'hours': 24 * 5}).getTotalSeconds();
        let interval2 = TrackingInterval.fromObject({
            startTimeSeconds: threeDaysAgo,
            endTimeSeconds: threeDaysAgo + TimeObject.fromObject(t2, TimeFormat.HMS).getTotalSeconds()
        });
        let startOfToday = (Date.now() / 1000) - TimeObject.fromObject({'hours': 24}).getTotalSeconds();
        let interval3 = TrackingInterval.fromObject({
            startTimeSeconds: startOfToday,
            endTimeSeconds: startOfToday + TimeObject.fromObject(t3, TimeFormat.HMS).getTotalSeconds()
        });
        let twoHoursAgo = (Date.now() / 1000) - (2 * 3600);
        let interval4 = TrackingInterval.fromObject({
            startTimeSeconds: twoHoursAgo,
            endTimeSeconds: twoHoursAgo + TimeObject.fromObject(t4, TimeFormat.HMS).getTotalSeconds()
        });
        
        [interval1, interval2, interval3, interval4].forEach(interval => {interval.setTrackingState(TrackingState.INACTIVE)});
        controller.setTrackingHistory(activity.getId(), [interval1, interval2, interval3, interval4]);
        let expectedTotalSecondsWithinOneHour = 3600;
        let timeSpentWithinOneHour = TimeObject.fromObject(controller.getTotalTrackedTime(activity.getId(), {'hours': 1}).trackedTime);

        let expectedTotalSecondsWithinOneDay = TimeObject.fromObject(t4).getTotalSeconds() + TimeObject.fromObject(t3).getTotalSeconds();
        let timeSpentWithinOneDay = TimeObject.fromObject(controller.getTotalTrackedTime(activity.getId(), {'hours': 24}).trackedTime);

        let expectedTotalSecondsWithinFiveDays = TimeObject.fromObject(t4).getTotalSeconds() + TimeObject.fromObject(t3).getTotalSeconds() + TimeObject.fromObject(t2).getTotalSeconds();
        let timeSpentWithinFiveDays = TimeObject.fromObject(controller.getTotalTrackedTime(activity.getId(), {'hours': 24 * 5}).trackedTime);

        let expectedTotalSecondsWithinSixDaysAgo = (0.5 * TimeObject.fromObject(t1).getTotalSeconds()) + TimeObject.fromObject(t4).getTotalSeconds() + TimeObject.fromObject(t3).getTotalSeconds() + TimeObject.fromObject(t2).getTotalSeconds();
        let timeSpentWithinSixDaysAgo = TimeObject.fromObject(controller.getTotalTrackedTime(activity.getId(), {'hours': 24 * 6}).trackedTime);

        assert(numbersAreWithinAcceptablePrecision(timeSpentWithinOneHour.getTotalSeconds(), expectedTotalSecondsWithinOneHour, 2));
        assert(numbersAreWithinAcceptablePrecision(timeSpentWithinOneDay.getTotalSeconds(), expectedTotalSecondsWithinOneDay, 2));
        assert(numbersAreWithinAcceptablePrecision(timeSpentWithinFiveDays.getTotalSeconds(), expectedTotalSecondsWithinFiveDays, 2));
        assert(numbersAreWithinAcceptablePrecision(timeSpentWithinSixDaysAgo.getTotalSeconds(), expectedTotalSecondsWithinSixDaysAgo, 2));
    });
    it('should be able to set tracking interval duration', async function() {
        let expectedSeconds = 12;
        let expectedMins = 45;
        let expectedHours = 30;
        let totalExpectedSeconds = expectedSeconds + (expectedMins * 60) + (expectedHours * 60 * 60);
        let activity: Activity = controller.createAndReturnActivity("sports");
        let now = (Date.now() / 1000);
        let interval = new TrackingInterval(now - (totalExpectedSeconds * 2));
        interval.endTimeSeconds = interval.startTimeSeconds + 1;
        interval.setTrackingState(TrackingState.INACTIVE);
        controller.setTrackingHistory(activity.getId(), [interval]);
        assert(numbersAreWithinAcceptablePrecision(activity.getTotalTrackedTime().getTotalSeconds(), 1));
        controller.setIntervalTime(activity.getId(), activity.getTrackingHistory()[0].getId(), {seconds: expectedSeconds, mins: expectedMins, hours: expectedHours});
        assert(numbersAreWithinAcceptablePrecision(activity.getTotalTrackedTime().getTotalSeconds(), totalExpectedSeconds));
    });
    it('should be able to copy from one instance to another', async function() {
        let activity: Activity = controller.createAndReturnActivity("act1", new RGBColor(10, 20, 30));
        await track(activity, 1000);
        await track(activity, 1000);
        let activityCopy: Activity = Activity.copy(activity);
        assert(activityEquals(activityCopy, activity));
    });
    it("should have all data footprints deleted from the store when deleted", function() {
        let activityId: uuidv4 = controller.createActivity();
        let project: Project = controller.createAndReturnProject("proj1");
        project.addTrackable(store.getTrackableById(activityId));
        assert(project.getTrackables().length === 1);
        assert(store.getTrackableById(activityId) !== null);
        assert(store.getTrackableById(activityId)?.getId() === activityId);
        controller.deleteTrackable(activityId);
        assert(store.getTrackableById(activityId) === null);
        assert(project.getTrackables().length === 0);
    });
    it("should be able to delete tracking interval", async function() {
        let activity: Activity = controller.createAndReturnActivity();
        activity.startTracking();
        await track(activity, 1000);
        assert(activity.getTrackingHistory().length === 1);
        assert(store.getAllTrackingIntervals().length === 1);
        await controller.deleteInterval(activity.getTrackingHistory()[0].getId());
        assert(activity.getTrackingHistory().length === 0);
        assert(store.getAllTrackingIntervals().length === 0);
    });
});
describe("Project", function() {
    let store = null;
    let controller = null;
    this.timeout(15000);
    beforeEach(function() {  
        store = new JsonPersistentStore(new StorePersistenceMock());
        controller = new TrackableController(store, new NoLogger());
    });
    it("should have state set to Active while actively tracking", function() {
        let activity: Activity = controller.createAndReturnActivity("gynmastics", new RGBColor(0, 128, 128));
        let project: Project = controller.createAndReturnProject("digital art", new RGBColor(0, 128, 128));
        controller.addTrackableToProject(project.getId(), activity.getId());
        // track the project through tracking the subtrackable (activity)
        activity.startTracking();
        assert(project instanceof Project);
        assert((project.getTrackingState() === TrackingState.ACTIVE) && project.getTrackingState());
    });
    it("shoud have state set to INACTIVE when not actively tracking", async function() {
        let id: uuidv4 = controller.createActivity("gynmastics", new RGBColor(0, 128, 128));
        let activity: Activity = controller.createAndReturnActivity("gynmastics", new RGBColor(0, 128, 128));
        let projId: uuidv4 = controller.createProject("digital art", new RGBColor(0, 128, 128));
        controller.addTrackableToProject(projId, id);
        let project: ITrackable = store.getTrackableById(projId);
        // track the project through tracking the subtrackable (activity)
        await track(activity, 1000)
            .then(() => assert((project.getTrackingState() === TrackingState.INACTIVE) && !project.getTrackingState()));
    });
    it("should have three tracking intervals in tracking history after undergoing three tracking sessions", async function() {
        let id = controller.createProject("digital art", new RGBColor(0, 128, 128));
        let project: Project = store.getTrackableById(id) as Project;
        let subactivityId = controller.createActivity("lineart", new RGBColor());
        let subactivity: Activity = store.getTrackableById(subactivityId) as Activity;
        project.addTrackable(subactivity);
        await track(subactivity, 1000)
            .then(trackable => track(trackable, 2000))
            .then(trackable => track(trackable, 3000))
            .then(trackable => {
                let history: Array<TrackingInterval> = project.getTrackingHistory();
                let expected = 3;
                assert(expected === history.length, `expected ${expected} intervals in tracking history for trackable, but got ${history.length}`);
                let expectedTotalTime: number = 0;
                for (let i = 1; i < 4; ++i) {
                    let intervalSeconds: number = history[i - 1].toTimeObject(TimeFormat.S).getTotalSeconds();
                    expectedTotalTime += intervalSeconds;
                    assert(numbersAreWithinAcceptablePrecision(i, intervalSeconds), `expected interval time of ${i} seconds, but got ${intervalSeconds}`);
                }
                let actualTotalTime: number = trackable.getTotalTrackedTime(TimeFormat.S, null).getTotalSeconds();
                assert(numbersAreWithinAcceptablePrecision(expectedTotalTime, actualTotalTime), `expected total time of ${expectedTotalTime}, but got actual total time of ${actualTotalTime}`);
            });
    });
    it("should add activity and subproject", function() {
        let art: Project = controller.createAndReturnProject("art", new RGBColor(0, 128, 128));
        let sketching: Activity = controller.createAndReturnActivity("sketching", new RGBColor(100, 0, 0));
        let digitalArt: Project = controller.createAndReturnProject("digital art", new RGBColor(0, 100, 100));
        let digitalColoring: Activity = controller.createAndReturnActivity("digital coloring", new RGBColor(10, 100, 100));
        let digitalLineArt: Activity = controller.createAndReturnActivity("digital line art", new RGBColor(10, 100, 100));
        let emptyProject: Project = controller.createAndReturnProject("empty project", new RGBColor(0, 0, 0));

        controller.addTrackableToProject(art.getId(), sketching.getId());
        controller.addTrackableToProject(digitalArt.getId(), digitalLineArt.getId());
        controller.addTrackableToProject(art.getId(), digitalArt.getId());
        controller.addTrackableToProject(digitalArt.getId(), digitalColoring.getId());

        // attempt to create a cyclic tree by adding digitalColoring to root of its own tree
        controller.addTrackableToProject(art.getId(), digitalColoring.getId());

        // attempt to create a cyclic tree by adding some empty project to itself
        controller.addTrackableToProject(emptyProject.getId(), emptyProject.getId());

        // attempt to create a cyclic tree by adding art project to itself
        controller.addTrackableToProject(art.getId(), art.getId());
        
        assert(!art.trackables.has(art.getId()), "Cyclic dependency: art project should not be able to add itself as a subproject");
        assert(sketching.getTrackable(sketching.getId()) !== null);
        assert(art.getTrackable(sketching.getId()) !== null);
        assert(art.getTrackable(digitalLineArt.getId()) !== null);
        assert(art.getTrackable(uuidv4()) === null, "should fail to return trackable for random id");
        assert(!art.trackables.has(digitalColoring.getId()), "art should not directly own digital coloring activity (is directly owned by digital art, which is directly owned by art)");
        assert(emptyProject.getTrackables().length === 0);
        assert(!art.getTrackables().includes(art.getId()));
    });
    it("should be tracked when its trackables are tracked", async function() {
        let art: Project = controller.createAndReturnProject("art", new RGBColor(1, 2 ,3));
        let sketching: Activity = controller.createAndReturnActivity("sketching", new RGBColor(0, 0, 0));
        let digitalArt: Project = controller.createAndReturnProject("digital art", new RGBColor(0, 0, 0));
        let digitalLineArt: Activity = controller.createAndReturnActivity("digital line art", new RGBColor(10, 100, 100));
        let digitalColoring: Activity = controller.createAndReturnActivity("digital coloring", new RGBColor(10, 100, 100));

        controller.addTrackableToProject(digitalArt.getId(), digitalLineArt.getId());
        controller.addTrackableToProject(digitalArt.getId(), digitalColoring.getId());
        controller.addTrackableToProject(art.getId(), sketching.getId());

        await track(sketching, 1000);
        let totalSecondsSpentSketching: number = sketching.getTotalTrackedTime(TimeFormat.S).getTotalSeconds();
        await track(digitalLineArt, 2000);
        let totalSecondsSpentInArt: number = art.getTotalTrackedTime(TimeFormat.S).getTotalSeconds();

        controller.addTrackableToProject(art.getId(), digitalArt.getId());
        await track(digitalColoring, 3000);
        let totalSecondsSpentForDigitalArt: number = digitalArt.getTotalTrackedTime(TimeFormat.S).getTotalSeconds();
        let totalSecondsSpentInArtIncludingDigitalArt: number = art.getTotalTrackedTime(TimeFormat.S).getTotalSeconds();

        assert(numbersAreWithinAcceptablePrecision(1, totalSecondsSpentSketching));
        assert(numbersAreWithinAcceptablePrecision(1, totalSecondsSpentInArt));
        assert(numbersAreWithinAcceptablePrecision(5, totalSecondsSpentForDigitalArt));
        assert(numbersAreWithinAcceptablePrecision(6, totalSecondsSpentInArtIncludingDigitalArt));
    });
    it("should be able to set color", async function() {
        let id: uuidv4 = controller.createProject("gynmastics", new RGBColor(0, 0, 0));
        let project: Project = store.getTrackableById(id);
        let colorObj = project.getColor().toObject();
        assert(colorObj['red'] === 0);
        assert(colorObj['green'] === 0);
        assert(colorObj['blue'] === 0);
        project.setColor(new RGBColor(10, 20, 30));
        colorObj = project.getColor().toObject();
        assert(colorObj['red'] === 10);
        assert(colorObj['green'] === 20);
        assert(colorObj['blue'] === 30);
    });
    it("should be able to set name", async function() {
        let originalName = "gynmastics";
        let newName = "exercise";
        let id: uuidv4 = controller.createProject(originalName, new RGBColor(0, 0, 0));
        let project: Project = store.getTrackableById(id);
        assert(project.getName() === originalName);
        project.setName(newName);
        assert(project.getName() === newName);
    });
    it("should dynamically determine total tracked time when adding/removing trackables", async function() {
        let art: Project = controller.createAndReturnProject("art", new RGBColor(1, 2 ,3));
        let sketching: Activity = controller.createAndReturnActivity("sketching", new RGBColor(0, 0, 0));
        let digitalArt: Project = controller.createAndReturnProject("digital art", new RGBColor(0, 0, 0));
        let digitalLineArt: Activity = controller.createAndReturnActivity("digital line art", new RGBColor(10, 100, 100));
        let digitalColoring: Activity = controller.createAndReturnActivity("digital coloring", new RGBColor(10, 100, 100));

        art.addTrackable(sketching);
        digitalArt.addTrackable(digitalColoring);
        digitalArt.addTrackable(digitalLineArt);
        art.addTrackable(digitalArt);

        await track(sketching, 1000);
        await track(digitalLineArt, 2000);
        await track(digitalColoring, 3000);

        assert(numbersAreWithinAcceptablePrecision(art.getTotalTrackedTime().getSeconds(), 6));
        assert(sketching.getObservers().size == 1);
        art.removeTrackable(sketching.getId());
        assert(sketching.getObservers().size == 0);
        assert(numbersAreWithinAcceptablePrecision(art.getTotalTrackedTime().getSeconds(), 5));
        assert(numbersAreWithinAcceptablePrecision(digitalArt.getTotalTrackedTime().getSeconds(), 5));
        assert(digitalColoring.getObservers().size === 1);
        digitalArt.removeTrackable(digitalColoring.getId());
        assert(digitalColoring.getObservers().size === 0);
        assert(numbersAreWithinAcceptablePrecision(digitalArt.getTotalTrackedTime().getSeconds(), 2));
        assert(numbersAreWithinAcceptablePrecision(art.getTotalTrackedTime().getSeconds(), 2));
        art.removeTrackable(digitalArt.getId());
        assert(numbersAreWithinAcceptablePrecision(art.getTotalTrackedTime().getSeconds(), 0));
    });
    it('should be able to set tracking interval duration indirectly through project subtrackable', async function() {
        let expectedSeconds = 12;
        let expectedMins = 45;
        let expectedHours = 30;
        let expectedTotalSeconds = expectedSeconds + (expectedMins * 60) + (expectedHours * 60 * 60);
        let project: Project = controller.createAndReturnProject("sports");
        let baseball: Activity = controller.createAndReturnActivity("baseball");
        project.addTrackable(baseball);
        let now = (Date.now() / 1000);
        let startTimeSeconds = now - expectedTotalSeconds;
        let interval = new TrackingInterval(startTimeSeconds);
        interval.endTimeSeconds = startTimeSeconds + 1;
        interval.setTrackingState(TrackingState.INACTIVE);
        baseball.setCurrentInterval(interval.getId());
        controller.setTrackingHistory(baseball.getId(), [interval]);
        assert(numbersAreWithinAcceptablePrecision(project.getTotalTrackedTime().getTotalSeconds(), 1));
        controller.setIntervalTime(baseball.getId(), baseball.getTrackingHistory()[0].getId(), {seconds: expectedSeconds, mins: expectedMins, hours: expectedHours});
        assert(numbersAreWithinAcceptablePrecision(baseball.getTotalTrackedTime().getTotalSeconds(), expectedTotalSeconds));
        controller.setIntervalTime(baseball.getId(), baseball.getCurrentInterval().getId(), {seconds: 1, mins: 2, hours: 3});
        assert(numbersAreWithinAcceptablePrecision(project.getTotalTrackedTime().getTotalSeconds(), 1 + (2 * 60) + (3 * 60 * 60)));
    });
    it('should be able to copy from one instance to another', async function() {
        let project: Project = controller.createAndReturnProject("project1", new RGBColor(10, 20, 30));
        let activity: Activity = controller.createAndReturnActivity("activity1", new RGBColor(11, 22, 33));
        project.addTrackable(activity);
        await track(activity, 1000);
        await track(activity, 1000);
        let projectCopy: Project = Project.copy(project);
        assert(projectEquals(projectCopy, project));
    });
    it("should have all data footprints deleted from the store when deleted", function() {
        let subprojectDepth1: Project = controller.createAndReturnProject("depth1");
        let subprojectDepth2: Project = controller.createAndReturnProject("depth2");
        let project: Project = controller.createAndReturnProject("root");

        subprojectDepth1.addTrackable(subprojectDepth2);
        assert(subprojectDepth2.getObservers().size === 1);
        project.addTrackable(subprojectDepth1);

        assert(project.getTrackables().length === 1);
        assert(store.getTrackableById(subprojectDepth1.getId()) !== null);
        assert(store.getTrackableById(subprojectDepth1.getId())?.getId() === subprojectDepth1.getId());
        controller.deleteTrackable(subprojectDepth1.getId());
        assert(store.getTrackableById(subprojectDepth1.getId()) === null);
        assert(project.getTrackables().length === 0);
        assert(store.getTrackableById(subprojectDepth2.getId()).getObservers().size === 0);
    });
    it("should accurately report total tracked time", async function() {
        let activity: Activity = controller.createAndReturnActivity("activity2");
        let t1 = {'hours': 48};
        let t2 = {'hours': 30};
        let t3 = {'hours': 5};
        let t4 = {'hours': 2};
        let sevenDaysAgo = (Date.now() / 1000) - TimeObject.fromObject({"hours": 24 * 7}, TimeFormat.HMS).getTotalSeconds();
        let interval1 = TrackingInterval.fromObject({
            startTimeSeconds: sevenDaysAgo,
            endTimeSeconds: sevenDaysAgo + TimeObject.fromObject(t1, TimeFormat.HMS).getTotalSeconds()
        });
        let threeDaysAgo = (Date.now() / 1000) - TimeObject.fromObject({'hours': 24 * 5}).getTotalSeconds();
        let interval2 = TrackingInterval.fromObject({
            startTimeSeconds: threeDaysAgo,
            endTimeSeconds: threeDaysAgo + TimeObject.fromObject(t2, TimeFormat.HMS).getTotalSeconds()
        });
        let startOfToday = (Date.now() / 1000) - TimeObject.fromObject({'hours': 24}).getTotalSeconds();
        let interval3 = TrackingInterval.fromObject({
            startTimeSeconds: startOfToday,
            endTimeSeconds: startOfToday + TimeObject.fromObject(t3, TimeFormat.HMS).getTotalSeconds()
        });
        let twoHoursAgo = (Date.now() / 1000) - (2 * 3600);
        let interval4 = TrackingInterval.fromObject({
            startTimeSeconds: twoHoursAgo,
            endTimeSeconds: twoHoursAgo + TimeObject.fromObject(t4, TimeFormat.HMS).getTotalSeconds()
        });
        [interval1, interval2, interval3, interval4].forEach(interval => {interval.setTrackingState(TrackingState.INACTIVE)});
        let project: Project = controller.createAndReturnProject("project");
        project.addTrackable(activity);
        controller.setTrackingHistory(activity.getId(), [interval1, interval2, interval3, interval4]);
        let expectedTotalSecondsWithinOneHour = 3600;
        let timeSpentWithinOneHour = TimeObject.fromObject(controller.getTotalTrackedTime(project.getId(), {'hours': 1}).trackedTime);

        let expectedTotalSecondsWithinOneDay = TimeObject.addMultiple(TimeObject.fromObject(t4), TimeObject.fromObject(t3));
        let timeSpentWithinOneDay = TimeObject.fromObject(controller.getTotalTrackedTime(project.getId(), {'hours': 24}).trackedTime);

        let expectedTotalSecondsWithinFiveDays = TimeObject.addMultiple(TimeObject.fromObject(t4), TimeObject.fromObject(t3), TimeObject.fromObject(t2));
        let timeSpentWithinFiveDays = TimeObject.fromObject(controller.getTotalTrackedTime(project.getId(), {'hours': 24 * 5}).trackedTime);

        let expectedTotalSecondsWithinSixDaysAgo = TimeObject.addMultiple(
            new TimeObject((0.5 * TimeObject.fromObject(t1).getTotalSeconds())),
            TimeObject.fromObject(t4),
            TimeObject.fromObject(t3),
            TimeObject.fromObject(t2)
        );
        let timeSpentWithinSixDaysAgo = TimeObject.fromObject(controller.getTotalTrackedTime(project.getId(), {'hours': 24 * 6}).trackedTime);
        assert(numbersAreWithinAcceptablePrecision(timeSpentWithinOneHour.getTotalSeconds(), expectedTotalSecondsWithinOneHour, 2));
        assert(numbersAreWithinAcceptablePrecision(timeSpentWithinOneDay.getTotalSeconds(), expectedTotalSecondsWithinOneDay.getTotalSeconds(), 2));
        assert(numbersAreWithinAcceptablePrecision(timeSpentWithinFiveDays.getTotalSeconds(), expectedTotalSecondsWithinFiveDays.getTotalSeconds(), 2));
        assert(numbersAreWithinAcceptablePrecision(timeSpentWithinSixDaysAgo.getTotalSeconds(), expectedTotalSecondsWithinSixDaysAgo.getTotalSeconds(), 2));
    });
    it("should be able to delete tracking interval", async function() {
        let activity: Activity = controller.createAndReturnActivity();
        let project: Project = controller.createAndReturnProject();
        project.addTrackable(activity);
        activity.startTracking();
        await track(activity, 1000);
        assert(project.getTrackingHistory().length === 1);
        assert(store.getAllTrackingIntervals().length === 2);
        await controller.deleteInterval(activity.getTrackingHistory()[0].getId());
        assert(project.getTrackingHistory().length === 1);
        assert(store.getAllTrackingIntervals().length === 1);
        await controller.deleteInterval(project.getTrackingHistory()[0].getId());
        assert(project.getTrackingHistory().length === 0);
        assert(store.getAllTrackingIntervals().length === 0);
    });
});
describe("Conversion", async function() {
    let store = null;
    let controller: TrackableController = null;
    this.timeout(15000);
    beforeEach(function() {  
        store = new JsonPersistentStore(new StorePersistenceMock());
        controller = new TrackableController(store, new NoLogger());
    });
    it("should be able to convert an activity to project", async function() {
        let activity: Activity = controller.createAndReturnActivity("Actra", new RGBColor(10, 20, 30));
        await track(activity, 1000);
        await track(activity, 1000);
        let project: Project = Project.fromObject(store, controller.convertActivityToProject(activity.getId()));
        assert(numbersAreWithinAcceptablePrecision(project.getTotalTrackedTime().getTotalSeconds(), activity.getTotalTrackedTime().getTotalSeconds()));
        assert(project.getTrackingHistory().length === activity.getTrackingHistory().length);
        assert(activityEquals(project.projectActivity, activity));
    });
    it("should be able to convert a project to an activity", async function() {
        let project: Project = controller.createAndReturnProject("Actra", new RGBColor(10, 20, 30));
        let subtrackable: Activity = controller.createAndReturnActivity("subtrackable");
        await track(subtrackable, 1000);
        await track(subtrackable, 1000);
        let activity: Activity = Activity.fromObject(store, await controller.convertProjectToActivity(project.getId()));
        assert(numbersAreWithinAcceptablePrecision(project.getTotalTrackedTime().getTotalSeconds(), activity.getTotalTrackedTime().getTotalSeconds()));
        assert(project.getTrackingHistory().length === activity.getTrackingHistory().length);
        assert(activityEquals(project.projectActivity, activity));
    });
    it("should be able to convert an activity to project while it is actively tracking", async function() {
        let activity: Activity = controller.createAndReturnActivity("Actra", new RGBColor(10, 20, 30));
        await track(activity, 1000);
        await track(activity, 1000);
        activity.startTracking();
        let project: Project = Project.fromObject(store, controller.convertActivityToProject(activity.getId()));
        assert(numbersAreWithinAcceptablePrecision(project.getTotalTrackedTime().getTotalSeconds(), activity.getTotalTrackedTime().getTotalSeconds()));
        assert(project.getTrackingHistory().length === activity.getTrackingHistory().length);
        assert(activityEquals(project.projectActivity, activity));
    });
    it("should be able to convert a project to an activity while it is actively tracking", async function() {
        let project: Project = controller.createAndReturnProject("Actra", new RGBColor(10, 20, 30));
        let subtrackable: Activity = controller.createAndReturnActivity("subtrackable");
        await track(subtrackable, 1000);
        await track(subtrackable, 1000);
        subtrackable.startTracking();
        let activity: Activity = Activity.fromObject(store, await controller.convertProjectToActivity(project.getId()));
        assert(numbersAreWithinAcceptablePrecision(project.getTotalTrackedTime().getTotalSeconds(), activity.getTotalTrackedTime().getTotalSeconds()));
        assert(project.getTrackingHistory().length === activity.getTrackingHistory().length);
        assert(activityEquals(project.projectActivity, activity));
    });
});
describe("Controller", function() {
    let store = null;
    let controller: TrackableController = null;
    this.timeout(15000);
    beforeEach(function() {  
        store = new JsonPersistentStore(new StorePersistenceMock());
        controller = new TrackableController(store, new NoLogger());
    });
    it("should be able to join multiple activities together into one activity", async function() {
        let expectedTotalTrackedTime = 0;
        let expectedName = "joined activities";
        let activitiesToJoin: uuidv4[] = [];
        for (let i = 1; i < 6; ++i) {
            let activityId = controller.createActivity(`${i}`, new RGBColor());
            activitiesToJoin.push(activityId);
            let interval = new TrackingInterval((Date.now() / 1000) - i);
            interval.endTimeSeconds = Date.now() / 1000;
            interval.setTrackingState(TrackingState.INACTIVE);
            controller.setTrackingHistory(activityId, [interval]);
            expectedTotalTrackedTime = expectedTotalTrackedTime + i;
        };
        let proj1 = controller.createProject('proj1');
        let proj2 = controller.createProject('proj1');
        controller.addTrackableToProject(proj1, activitiesToJoin[0]);
        assert(store.getTrackableById(proj1).trackables.has(activitiesToJoin[0]));
        controller.addTrackableToProject(proj2, activitiesToJoin[1]);
        assert(store.getTrackableById(proj2).trackables.has(activitiesToJoin[1]));
        assert([...store.getActivities().keys()].length === 5);
        assert(
            numbersAreWithinAcceptablePrecision(
                [...store.getActivities().values()]
                .map((activity: Activity) => activity.getTotalTrackedTime().getTotalSeconds())
                .reduce((prev, curr) => prev + curr), expectedTotalTrackedTime
            )
        );
        const returnObj = await controller.joinTrackables(expectedName, activitiesToJoin);
        let joinedActivity = Activity.fromObject(store, returnObj);
        assert([...store.getActivities().keys()].length === 1);
        assert(numbersAreWithinAcceptablePrecision(joinedActivity.getTotalTrackedTime().getTotalSeconds(), expectedTotalTrackedTime));
        assert(joinedActivity.getName() === expectedName);
        assert(store.getTrackableById(proj1).trackables.size === 1);
        assert(store.getTrackableById(proj1).trackables.has(joinedActivity.getId()));
        assert(joinedActivity.getObservers().size === 2);
        assert(joinedActivity.getObservers().has(proj1));
        assert(joinedActivity.getObservers().has(proj2));
    });
    it("should be able to join multiple project together into one activity", async function() {
        let expectedTotalTrackedTime = 0;
        let expectedName = "joined activities";
        let projectsToJoin: uuidv4[] = [];
        for (let i = 1; i < 6; ++i) {
            let projectId = controller.createProject(`project_${i}`, new RGBColor());
            projectsToJoin.push(projectId);
            let interval = new TrackingInterval((Date.now() / 1000) - i);
            interval.endTimeSeconds = Date.now() / 1000;
            interval.setTrackingState(TrackingState.INACTIVE);
            let subactivityId: uuidv4 = controller.createActivity(`activity_${i}`, new RGBColor());
            controller.addTrackableToProject(projectId, subactivityId);
            controller.setTrackingHistory(subactivityId, [interval]);
            expectedTotalTrackedTime = expectedTotalTrackedTime + i;
        };
        assert([...store.getProjects().keys()].length === 5);
        assert(numbersAreWithinAcceptablePrecision([...store.getProjects().values()]
            .map((project: Project) => project.getTotalTrackedTime().getTotalSeconds())
            .reduce((prev, curr) => prev + curr), expectedTotalTrackedTime));
        let joinedActivity = Activity.fromObject(store, await controller.joinTrackables(expectedName, projectsToJoin));
        assert([...store.getProjects().keys()].length === 0);
        assert([...store.getActivities().keys()].length === 6); // note: this includes the 5 subactivities originally added respectively to the original 5 projects
        assert(numbersAreWithinAcceptablePrecision(joinedActivity.getTotalTrackedTime().getTotalSeconds(), expectedTotalTrackedTime));
        assert(joinedActivity.getName() === expectedName);
    });
    it("should stop currently active activity when another activity is started", async function() {
        let activity1 = controller.createAndReturnActivity("activity1");
        let activity2 = controller.createAndReturnActivity("activity2");
        controller.startTrackable(activity1.getId());
        assert(activity1.getTrackingState() === TrackingState.ACTIVE);
        assert(activity2.getTrackingState() === TrackingState.INACTIVE);
        controller.startTrackable(activity2.getId());
        assert(activity1.getTrackingState() === TrackingState.INACTIVE);
        assert(activity2.getTrackingState() === TrackingState.ACTIVE);
    });
    it("should stop currently active subactivity of project when another activity is started", async function() {
        let project = controller.createAndReturnProject("project");
        let activity1 = controller.createAndReturnActivity("activity1");
        project.addTrackable(activity1);
        let activity2 = controller.createAndReturnActivity("activity2");
        controller.startTrackable(activity1.getId());
        assert(project.getTrackingState() === TrackingState.ACTIVE);
        assert(activity1.getTrackingState() === TrackingState.ACTIVE);
        assert(activity2.getTrackingState() === TrackingState.INACTIVE);
        controller.startTrackable(activity2.getId());
        assert(project.getTrackingState() === TrackingState.INACTIVE);
        assert(activity1.getTrackingState() === TrackingState.INACTIVE);
        assert(activity2.getTrackingState() === TrackingState.ACTIVE);
    });
    it("should return trackables that satisfy a given time span", async function() {
        let activities = [];
        let totalNumberOfActivities = 10;
        for (let i = 1; i <= totalNumberOfActivities; ++i) {
            let activity = controller.createAndReturnActivity(`activity_${i}`);
            let startTimeSeconds = (Date.now() / 1000) - (i * 3600);
            let interval = new TrackingInterval(startTimeSeconds);
            interval.endTimeSeconds = startTimeSeconds + 3600; // each interval has a duration 1 hour
            interval.setTrackingState(TrackingState.INACTIVE);
            controller.setTrackingHistory(activity.getId(), [interval]);
            activities.push(activity);
        }
        let timespan = {'since': {'hours': 10}, 'until': {'hours': 0}};
        assert(controller.getTrackablesIdsWithinTimeSpan(timespan).length === totalNumberOfActivities);
        timespan = {'since': {'hours': 11}, 'until': {'hours': -1}};
        assert(controller.getTrackablesIdsWithinTimeSpan(timespan).length === totalNumberOfActivities);
        timespan = {'since': {'hours': 6}, 'until': undefined};
        assert(controller.getTrackablesIdsWithinTimeSpan(timespan).length === 6);
        timespan = {'since': undefined, 'until': {'hours': 3}};
        assert(controller.getTrackablesIdsWithinTimeSpan(timespan).length === 8);
        timespan = {'since': {'hours': 6}, 'until': {'hours': 3}};
        assert(controller.getTrackablesIdsWithinTimeSpan(timespan).length === 4);
    });
    it("should accurately report exactly one activity (and only Activity) as the currently tracked activity", function() {
        let activity1Id = controller.createActivity("act1");
        let activity2Id = controller.createActivity("act2");
        let projectId = controller.createProject("proj");

        controller.startTrackable(activity1Id);
        assert(controller.getCurrentlyActiveTrackableId() === activity1Id);
        assert(store.getCurrentlyActiveTrackableId() === activity1Id);

        controller.startTrackable(activity2Id)
        assert(controller.getCurrentlyActiveTrackableId() === activity2Id);
        assert(store.getCurrentlyActiveTrackableId() === activity2Id);

        controller.startTrackable(projectId);
        assert(controller.getCurrentlyActiveTrackableId() !== projectId);
        assert(controller.getCurrentlyActiveTrackableId() === activity2Id);
        assert(store.getCurrentlyActiveTrackableId() !== projectId);
        assert(store.getCurrentlyActiveTrackableId() === activity2Id);
    });
    it("should be able to set fields of tracking interval", async function() {
        let activity = controller.createAndReturnActivity("act1");
        let project = controller.createAndReturnProject("proj1");

        await track(activity, 1000);
        await track(project, 1000);

        assert(numbersAreWithinAcceptablePrecision(activity.getTotalTrackedTime().getTotalSeconds(), 1));
        assert(numbersAreWithinAcceptablePrecision(activity.getTotalTrackedTime().getTotalSeconds(), 1));

        let activityInterval = activity.getTrackingHistory()[0];
        controller.setTrackingInterval(activityInterval.getId(), {startTimeSeconds: (Date.now() - 20000)/1000, endTimeSeconds: (Date.now()/1000)});
        assert(numbersAreWithinAcceptablePrecision(activityInterval.toTimeObject().getTotalSeconds(), 20));
        controller.setTrackingInterval(activityInterval.getId(), {startTimeSeconds: (Date.now() - 10000)/1000, endTimeSeconds: (Date.now()/1000)});
        assert(numbersAreWithinAcceptablePrecision(activityInterval.toTimeObject().getTotalSeconds(), 10));
        controller.setTrackingInterval(activityInterval.getId(), {startTimeSeconds: (Date.now()/1000), endTimeSeconds: ((Date.now() + 30000)/1000)});
        assert(numbersAreWithinAcceptablePrecision(activityInterval.toTimeObject().getTotalSeconds(), 30));
        let start = (Date.now() - 50000)/1000;
        let end = (Date.now() + 30000)/1000;
        controller.setTrackingInterval(activityInterval.getId(), {startTimeSeconds: start, endTimeSeconds: end});
        assert(numbersAreWithinAcceptablePrecision(activityInterval.toTimeObject().getTotalSeconds(), 80));
        assert(numbersAreWithinAcceptablePrecision(activityInterval.startTimeSeconds, start));
        assert(numbersAreWithinAcceptablePrecision(activityInterval.endTimeSeconds, end));

        let projectInterval = project.getTrackingHistory()[0];
        controller.setTrackingInterval(projectInterval.getId(), {startTimeSeconds: (Date.now() - 20000)/1000, endTimeSeconds: (Date.now()/1000)});
        assert(numbersAreWithinAcceptablePrecision(projectInterval.toTimeObject().getTotalSeconds(), 20));
        controller.setTrackingInterval(projectInterval.getId(), {startTimeSeconds: (Date.now() - 10000)/1000, endTimeSeconds: (Date.now()/1000)});
        assert(numbersAreWithinAcceptablePrecision(projectInterval.toTimeObject().getTotalSeconds(), 10));
        controller.setTrackingInterval(projectInterval.getId(), {startTimeSeconds: (Date.now()/1000), endTimeSeconds: ((Date.now() + 30000)/1000)});
        assert(numbersAreWithinAcceptablePrecision(projectInterval.toTimeObject().getTotalSeconds(), 30));
        start = (Date.now() - 50000)/1000;
        end = (Date.now() + 30000)/1000;
        controller.setTrackingInterval(projectInterval.getId(), {startTimeSeconds: start, endTimeSeconds: end});
        assert(numbersAreWithinAcceptablePrecision(projectInterval.toTimeObject().getTotalSeconds(), 80));
        assert(numbersAreWithinAcceptablePrecision(projectInterval.startTimeSeconds, start));
        assert(numbersAreWithinAcceptablePrecision(projectInterval.endTimeSeconds, end));
    });
});
describe("Store", function() {
    let testDataDir = "testDataDir";
    let store: IPersistentAndSerializableStore = null;
    let controller = null;
    this.timeout(15000);
    beforeEach(async function() {  
        await fs.promises.access(testDataDir).then(() => rmfr(testDataDir)).catch(() => {});
        await fs.promises.mkdir(testDataDir);
        store = new JsonPersistentStore(new FileSystemStorePersistence("testDataDir", "store.json"));
        controller = new TrackableController(store, new NoLogger());
        let art = controller.createAndReturnProject("art");
        let sketching = controller.createAndReturnActivity("sketching");
        let digitalArt = controller.createAndReturnProject("digital art");
        let digitalLineArt = controller.createAndReturnActivity("digital line art");
        let digitalColoring = controller.createAndReturnActivity("digital coloring");
        controller.addTrackableToProject(digitalArt.getId(), digitalLineArt.getId());
        controller.addTrackableToProject(digitalArt.getId(), digitalColoring.getId());
        controller.addTrackableToProject(art.getId(), digitalArt.getId());
        controller.addTrackableToProject(art.getId(), sketching.getId());

        await track(sketching, 1000);
        await track(digitalLineArt, 2000);
        await track(digitalColoring, 3000);
        await track(digitalColoring, 1000);
    });
    afterEach(async function() {
        await rmfr(testDataDir).catch(e => console.log(e));
    })
    it("should be serializable, and restorable to deserialized form by IStoreDeserializer", function () {
        let jsonSerializedStore: string = store.serialize();
        let loadedStore: ITrackablesStore = new JSONStoreDeserializer().deserialize(jsonSerializedStore);
        storesAreEqual(store, loadedStore);
    });
    it("should be saved and loaded from file system if file system based persistence layer is used", async function() {
        assert(store.getAllTrackableIds().length > 0);
        await store.save();
        let storeFileIsAccessible: boolean = await fs.promises.access(`./${testDataDir}/store.json`).then(() => true).catch(() => false);
        assert(storeFileIsAccessible);
        let loadedStore: IPersistentStore = new JsonPersistentStore(new FileSystemStorePersistence(testDataDir, "store.json"));
        assert(loadedStore.getAllTrackableIds().length === 0);
        await loadedStore.load();
        storesAreEqual(store, loadedStore);
    });
    it("should persist info about currently active trackable", async function() {
        let activity1Id = controller.createActivity("act1");
        controller.startTrackable(activity1Id);
        assert(store.getCurrentlyActiveTrackableId() === activity1Id);
        await store.save();
        let loadedStore: IPersistentStore = new JsonPersistentStore(new FileSystemStorePersistence(testDataDir, "store.json"));
        await loadedStore.load();
        assert(loadedStore.getCurrentlyActiveTrackableId() === activity1Id);
        controller.stopTrackable(activity1Id);
        await store.save();
        await loadedStore.load();
        assert(loadedStore.getCurrentlyActiveTrackableId() === null);
    });
});