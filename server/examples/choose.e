

(query [x]
       (= salary 10)
       (choose [x salary]
               (query (> salary 8)
                      (= x "greedy"))
               (query (< salary 4)
                      (= x "poor"))
               (query (= x "content"))))

