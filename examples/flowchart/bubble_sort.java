// Bubble sort in Java — click "📊 Flowchart" to see the nested loops.
// The flowchart works for any C-family language, not just JS/Python.

public class BubbleSort {
  public static void sort(int[] arr) {
    for (int i = 0; i < arr.length; i++) {
      for (int j = 0; j < arr.length - 1; j++) {
        if (arr[j] > arr[j + 1]) {
          int temp = arr[j];
          arr[j] = arr[j + 1];
          arr[j + 1] = temp;
        }
      }
    }
  }
}
