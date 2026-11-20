"""Generate a first printable shell for the Xiaon voice companion.

The first prototype assumes a M5Stack CoreS3 main unit (54 x 54 x 15.5 mm)
inside a round puck.  Dimensions are deliberately collected at the top so the
shell can be regenerated for a different board after a caliper check.

Requires the small local CAD environment used for this artifact:
    python -m venv /tmp/codex-cad-venv
    /tmp/codex-cad-venv/bin/pip install trimesh manifold3d
"""

from __future__ import annotations

from pathlib import Path
import math

import trimesh
from trimesh.transformations import rotation_matrix


# ---- fit envelope (millimetres) -----------------------------------------
OUTER_RADIUS = 48.0
LOWER_HEIGHT = 20.0
WALL = 3.2
FLOOR = 3.0
INNER_RADIUS = OUTER_RADIUS - WALL

# The M5Stack CoreS3 main unit is specified as 54 x 54 x 15.5 mm.
BOARD_X = 54.0
BOARD_Y = 54.0
BOARD_Z = 15.5
BOARD_CLEARANCE = 1.8

BEZEL_HEIGHT = 4.0
BEZEL_OPENING_RADIUS = 30.0  # 60 mm circular opening for the square display
WINDOW_RADIUS = 29.4
WINDOW_THICKNESS = 2.0

SECTIONS = 128
MIC_HOLE_RADIUS = 1.4  # 2.8 mm diameter, safer with the A1 mini's 0.4 mm nozzle
OUT = Path(__file__).resolve().parent / "stl"
OUT.mkdir(parents=True, exist_ok=True)


def moved(mesh: trimesh.Trimesh, xyz: tuple[float, float, float]) -> trimesh.Trimesh:
    mesh = mesh.copy()
    mesh.apply_translation(xyz)
    return mesh


def cylinder(radius: float, height: float, z: float, *, sections=SECTIONS) -> trimesh.Trimesh:
    return moved(trimesh.creation.cylinder(radius=radius, height=height, sections=sections), (0, 0, z))


def box(size: tuple[float, float, float], xyz: tuple[float, float, float]) -> trimesh.Trimesh:
    return moved(trimesh.creation.box(extents=size), xyz)


def horizontal_cylinder(radius: float, length: float, xyz: tuple[float, float, float], axis: str) -> trimesh.Trimesh:
    """Cylinder through a wall, with its axis along x or y."""
    mesh = trimesh.creation.cylinder(radius=radius, height=length, sections=48)
    if axis == "y":
        mesh.apply_transform(rotation_matrix(math.pi / 2, [1, 0, 0]))
    elif axis == "x":
        mesh.apply_transform(rotation_matrix(math.pi / 2, [0, 1, 0]))
    else:
        raise ValueError(axis)
    mesh.apply_translation(xyz)
    return mesh


def boolean_difference(base: trimesh.Trimesh, cutters: list[trimesh.Trimesh]) -> trimesh.Trimesh:
    result = base
    for cutter in cutters:
        result = trimesh.boolean.difference([result, cutter], engine="manifold")
        if result is None:
            raise RuntimeError("boolean difference failed")
    result.process(validate=True)
    return result


def boolean_union(parts: list[trimesh.Trimesh]) -> trimesh.Trimesh:
    result = trimesh.boolean.union(parts, engine="manifold")
    if result is None:
        raise RuntimeError("boolean union failed")
    result.process(validate=True)
    return result


def lower_shell() -> trimesh.Trimesh:
    # A lightly chamfered outer puck, hollowed from the top.
    outer = trimesh.creation.revolve(
        [(0, 0), (44, 0), (OUTER_RADIUS, 4), (OUTER_RADIUS, 16), (46.0, LOWER_HEIGHT), (0, LOWER_HEIGHT)],
        sections=SECTIONS,
    )
    cavity = trimesh.creation.revolve(
        [(0, FLOOR), (INNER_RADIUS - 3, FLOOR), (INNER_RADIUS, FLOOR + 3), (INNER_RADIUS, LOWER_HEIGHT + 2), (0, LOWER_HEIGHT + 2)],
        sections=SECTIONS,
    )

    cutters: list[trimesh.Trimesh] = [cavity]

    # Front acoustic vents: five speaker holes and two microphone holes.
    for x in (-10, -5, 0, 5, 10):
        cutters.append(horizontal_cylinder(1.35, 10, (x, -46, 5.5), "y"))
    for x in (-10, 10):
        cutters.append(horizontal_cylinder(MIC_HOLE_RADIUS, 10, (x, -46, 11.0), "y"))

    # Rear USB-C service opening.  It is intentionally generous for a first fit.
    cutters.append(box((22, 10, 9), (0, 46, 9)))
    shell = boolean_difference(outer, cutters)

    # Four low support pads keep the board off the floor and leave room for a
    # thin foam strip.  They are fused into the cup so they print as one part.
    pads = [
        box((12, 12, 2.0), (sx, sy, FLOOR + 1.0))
        for sx in (-27, 27)
        for sy in (-27, 27)
    ]

    # Keep the first print free of unsupported alignment details. The bezel
    # can still be located by the circular rim; keyed posts will be added
    # after the first physical fit check.
    posts: list[trimesh.Trimesh] = []
    return boolean_union([shell, *pads, *posts])


def bezel() -> trimesh.Trimesh:
    outer = cylinder(OUTER_RADIUS, BEZEL_HEIGHT, LOWER_HEIGHT + BEZEL_HEIGHT / 2)
    opening = cylinder(BEZEL_OPENING_RADIUS, BEZEL_HEIGHT + 2, LOWER_HEIGHT + BEZEL_HEIGHT / 2)
    holes = [
        moved(cylinder(2.0, BEZEL_HEIGHT + 2, LOWER_HEIGHT + BEZEL_HEIGHT / 2), p)
        for p in ((45.8, 0, 0), (-45.8, 0, 0), (0, 45.8, 0), (0, -45.8, 0))
    ]
    return boolean_difference(outer, [opening, *holes])


def window_insert() -> trimesh.Trimesh:
    # Optional transparent or translucent insert.  Print this separately so
    # the display can be tested with it removed.
    return cylinder(WINDOW_RADIUS, WINDOW_THICKNESS, LOWER_HEIGHT + BEZEL_HEIGHT - WINDOW_THICKNESS / 2)


def export(name: str, mesh: trimesh.Trimesh) -> None:
    mesh.export(OUT / name, file_type="stl")
    print(f"{name}: watertight={mesh.is_watertight} bounds={mesh.bounds.tolist()} faces={len(mesh.faces)}")


if __name__ == "__main__":
    export("xiaon_round_shell_lower.stl", lower_shell())
    export("xiaon_round_shell_bezel.stl", bezel())
    export("xiaon_round_shell_window_insert.stl", window_insert())
