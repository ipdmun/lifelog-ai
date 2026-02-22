declare module 'ical.js' {
    export const parse: (input: string) => any[];
    export class Component {
        constructor(jcal: any[] | string);
        getAllSubcomponents(name: string): Component[];
        getFirstPropertyValue(name: string): any;
    }
    export class Event {
        constructor(component: Component | any);
        summary: string;
        startDate: { toJSDate: () => Date };
        endDate: { toJSDate: () => Date };
        description: string;
    }
}
