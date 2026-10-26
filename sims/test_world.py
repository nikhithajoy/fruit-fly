"""Check the odor field, antennae and ORN rates make sense."""
import matplotlib.pyplot as plt
import numpy as np

from flybrain.world import Fly, OdorSource, orn_rate

source = OdorSource(x=0, y=0)

tests = [
    ("facing the source", np.radians(90 * 0)),
    ("source on its right", np.radians(90)),
    ("facing away", np.radians(180)),
]

for label, heading in tests:
    fly = Fly(x=-40, y=0, heading=heading)
    left, right = fly.antenna_positions()
    c_left = source.concentration(*left)
    c_right = source.concentration(*right)
    print(f"{label:22} left: {orn_rate(c_left):5.1f} Hz   right: {orn_rate(c_right):5.1f} Hz")

xs = np.linspace(-100, 100, 200)
X, Y = np.meshgrid(xs, xs)
C = source.concentration(X, Y)

plt.figure(figsize=(6, 5))
plt.imshow(C, extent=(-100, 100, -100, 100), origin="lower", cmap="viridis")
plt.colorbar(label="odor concentration")
fly = Fly(x=-40, y=0, heading=np.radians(90))
for (ax_, ay_), color in zip(fly.antenna_positions(), ["red", "orange"]):
    plt.plot(ax_, ay_, "o", color=color, markersize=4)
plt.plot(fly.x, fly.y, "w^", markersize=8)
plt.title("Odor field (red = left antenna, orange = right)")
plt.xlabel("x (mm)")
plt.ylabel("y (mm)")
plt.savefig("sims/test_world.png", dpi=120)
plt.show()