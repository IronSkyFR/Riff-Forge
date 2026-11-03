package fr.ironsky.riffforge.portage;

import android.app.Activity;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;

/**
 * Standalone porting helper for Riff Forge 2.3.1 WebView Activity.
 *
 * Call ONCE after setContentView(root):
 *     LegacyInsets.attach(this, root);
 *
 * The root container must own insets. Do not add the same bottom inset a second
 * time in the HTML/CSS (env(safe-area-inset-bottom)) or in a second WebView listener.
 * The music engine, audio focus and original UI are deliberately untouched.
 */
public final class LegacyInsets {
    private LegacyInsets() {}

    public static void attach(Activity activity, View root) {
        if (activity == null || root == null) {
            throw new IllegalArgumentException("Activity et conteneur requis");
        }
        final int originalLeft = root.getPaddingLeft();
        final int originalTop = root.getPaddingTop();
        final int originalRight = root.getPaddingRight();
        final int originalBottom = root.getPaddingBottom();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            activity.getWindow().setDecorFitsSystemWindows(false);
        } else {
            final View decor = activity.getWindow().getDecorView();
            decor.setSystemUiVisibility(decor.getSystemUiVisibility()
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }

        root.setOnApplyWindowInsetsListener((view, insets) -> {
            int left, top, right, bottom;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                final android.graphics.Insets safe = insets.getInsets(
                    WindowInsets.Type.systemBars()
                    | WindowInsets.Type.displayCutout()
                    | WindowInsets.Type.ime()
                );
                left = safe.left; top = safe.top;
                right = safe.right; bottom = safe.bottom;
            } else {
                left = insets.getSystemWindowInsetLeft();
                top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight();
                bottom = insets.getSystemWindowInsetBottom();
            }
            view.setPadding(originalLeft + left, originalTop + top,
                            originalRight + right, originalBottom + bottom);
            return insets;
        });
        root.requestApplyInsets();
    }
}
