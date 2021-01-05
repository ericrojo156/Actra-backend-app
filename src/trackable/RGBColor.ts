interface RGBColorProps {
    red: number;
    green: number;
    blue: number;
};

export class RGBColor {
    red: number;
    green: number;
    blue: number;
    private sanitizeInput(value: number): number {
        if (typeof(value) !== 'undefined'
            && value !== null
            && !Number.isNaN(value)
            && 0 < value) {
                return Math.min(value, 255);
        } else {
            return 0;
        }
    }
    constructor(r: number = 0, g: number = 0, b: number = 0) {
        this.red = this.sanitizeInput(r);
        this.green = this.sanitizeInput(g);
        this.blue = this.sanitizeInput(b);
    }
    equals(other: RGBColor): boolean {
        return this.red === other.red
            && this.green === other.green
            && this.blue === other.blue;
    }
    static fromObject(colorObj: RGBColorProps): RGBColor {
        if (!colorObj) {
            colorObj = {red: 0, green: 0, blue: 0};
        }
        return new RGBColor(
            colorObj.red,
            colorObj.green,
            colorObj.blue
        );
    }
    toObject(): Object {
        return {
            red: this.red,
            green: this.green,
            blue: this.blue
        };
    }
}