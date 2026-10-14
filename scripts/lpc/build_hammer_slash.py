"""Complete the hammer's two empty slash cells with rotated LPC poses."""

from pathlib import Path

from config import DEFAULT_SOURCE_ROOT
from rotated_action_frames import LayerTransfer, RotatedPose, write_rotated_action_frames


# Keys are (LPC direction row, missing frame). The source frame and pivot keep
# each rotated hammer aligned with the character's hand in that direction.
HAMMER_POSES = {
    (0, 2): RotatedPose(0, (79, 76), -90, (-5, -4)),
    (0, 3): RotatedPose(4, (82, 70), -45, (-12, 6)),
    (1, 2): RotatedPose(0, (51, 77), 45, (18, -2)),
    (1, 3): RotatedPose(4, (51, 72), 35, (6, 5)),
    (2, 2): RotatedPose(0, (72, 77), -65, (-4, -4)),
    (2, 3): RotatedPose(
        4, (84, 77), -45, (-8, 1),
        layer_transfer=LayerTransfer((69, 76, 75, 82), (72, 72), foreground_shift=(-1, 0)),
        final_shift=(-4, 5),
    ),
    (3, 2): RotatedPose(0, (83, 77), 65, (-8, 0)),
    (3, 3): RotatedPose(4, (79, 72), 45, (-4, 6)),
}


def build_hammer_slash_sources(source_root: Path = DEFAULT_SOURCE_ROOT) -> None:
    base = source_root / "tools/smash"
    write_rotated_action_frames(base, base / "completed", "hammer.png", 128, HAMMER_POSES)


if __name__ == "__main__":
    build_hammer_slash_sources()
