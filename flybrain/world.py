"""The world the fly lives in: a circular arena, an odor source, and the fly's body."""
from dataclasses import dataclass

import numpy as np


@dataclass
class OdorSource:
    x: float = 0.0
    y: float = 0.0
    peak: float = 1.0
    sigma: float = 30.0   # mm: how far the smell spreads

    def concentration(self, x, y):
        """Odor concentration at a point (or arrays of points)."""
        d2 = (x - self.x) ** 2 + (y - self.y) ** 2
        return self.peak * np.exp(-d2 / (2 * self.sigma ** 2))


def orn_rate(concentration, max_rate=150.0, half_max=0.3):
    """ORN firing rate (Hz) for a given odor concentration. Saturates at max_rate."""
    return max_rate * concentration / (concentration + half_max)


@dataclass
class Fly:
    x: float
    y: float
    heading: float = 0.0              # radians; 0 = facing +x, counterclockwise is positive
    speed: float = 10.0               # mm per second
    antenna_distance: float = 2.0     # mm from body center
    antenna_angle: float = np.radians(30)

    def antenna_positions(self):
        """(x, y) of the left and right antennae."""
        left_angle = self.heading + self.antenna_angle
        right_angle = self.heading - self.antenna_angle
        left = (self.x + self.antenna_distance * np.cos(left_angle),
                self.y + self.antenna_distance * np.sin(left_angle))
        right = (self.x + self.antenna_distance * np.cos(right_angle),
                 self.y + self.antenna_distance * np.sin(right_angle))
        return left, right

    def move(self, turn_rate, dt, arena_radius):
        """Turn (radians per second), then walk forward for dt seconds."""
        self.heading += turn_rate * dt
        self.x += self.speed * np.cos(self.heading) * dt
        self.y += self.speed * np.sin(self.heading) * dt

        r = np.hypot(self.x, self.y)
        if r > arena_radius:
            self.x *= arena_radius / r
            self.y *= arena_radius / r
            self.heading = np.arctan2(-self.y, -self.x)